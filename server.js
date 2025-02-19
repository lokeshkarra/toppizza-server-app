import fastify from "fastify";

import path from "path";
import { fileURLToPath } from "url";
import { AsyncDatabase } from "promised-sqlite3";
import crypto from "crypto";
import cron from "node-cron";
import axios from "axios";



const server = fastify({
  logger: {
    transport: {
      target: "pino-pretty",
    },
  },
});

const PORT = process.env.PORT || 3000;
const HOST = "RENDER" in process.env ? `0.0.0.0` : `localhost`;

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const db = await AsyncDatabase.open("./pizza.sqlite");

// Cron job to log a message every 10 minutes
cron.schedule("*/10 * * * *", async () => {
  console.log(`[CRON JOB] Running at ${new Date().toLocaleString()}`);

  try {
    // Ping your own API to prevent cold start
    const apiUrl = "https://toppizza-server-app.onrender.com/api/health"; // Change to your actual API
    await axios.get(apiUrl);
    console.log("[CRON JOB] Pinged API to prevent cold start.");
  } catch (error) {
    console.error("[CRON JOB] Failed to ping API:", error.message);
  }
});


cron.schedule("0 0 * * *", async () => {
  console.log(`[CRON JOB] Deleting old orders at ${new Date().toLocaleString()}`);

  try {
    const deleteQuery = `
      DELETE FROM orders 
      WHERE date < date('now', '-30 days')
    `;
    
    await db.run(deleteQuery);
    console.log("[CRON JOB] Successfully deleted orders older than 30 days.");
  } catch (error) {
    console.error("[CRON JOB] Failed to delete old orders:", error.message);
  }
});


server.addHook("preHandler", (req, res, done) => {
  res.header("Access-Control-Allow-Origin", "*");
  res.header("Access-Control-Allow-Methods", "GET, POST");
  res.header("Access-Control-Allow-Headers", "*");

  const isPreflight = /options/i.test(req.method);
  if (isPreflight) {
    return res.send();
  }
  done();
});

// Simple health check endpoint (add inside the routes section)
server.get("/api/health", async (req, res) => {
  res.send({ status: "OK", time: new Date().toLocaleString() });
});

server.get("/api/pizzas", async function getPizzas(req, res) {
  const pizzasPromise = db.all(
    "SELECT pizza_type_id, name, category, ingredients as description FROM pizza_types"
  );
  const pizzaSizesPromise = db.all(
    `SELECT 
      pizza_type_id as id, size, price
    FROM 
      pizzas
  `
  );

  const [pizzas, pizzaSizes] = await Promise.all([
    pizzasPromise,
    pizzaSizesPromise,
  ]);

  const responsePizzas = pizzas.map((pizza) => {
    const sizes = pizzaSizes.reduce((acc, current) => {
      if (current.id === pizza.pizza_type_id) {
        acc[current.size] = +current.price;
      }
      return acc;
    }, {});
    return {
      id: pizza.pizza_type_id,
      name: pizza.name,
      category: pizza.category,
      description: pizza.description,
      image: `/pizzas/${pizza.pizza_type_id}.webp`,
      sizes,
    };
  });

  res.send(responsePizzas);
});

server.get("/api/pizza-of-the-day", async function getPizzaOfTheDay(req, res) {
  const pizzas = await db.all(
    `SELECT 
      pizza_type_id as id, name, category, ingredients as description
    FROM 
      pizza_types`
  );

  const daysSinceEpoch = Math.floor(Date.now() / 86400000);
  const pizzaIndex = daysSinceEpoch % pizzas.length;
  const pizza = pizzas[pizzaIndex];

  const sizes = await db.all(
    `SELECT
      size, price
    FROM
      pizzas
    WHERE
      pizza_type_id = ?`,
    [pizza.id]
  );

  const sizeObj = sizes.reduce((acc, current) => {
    acc[current.size] = +current.price;
    return acc;
  }, {});

  const responsePizza = {
    id: pizza.id,
    name: pizza.name,
    category: pizza.category,
    description: pizza.description,
    image: `/pizzas/${pizza.id}.webp`,
    sizes: sizeObj,
  };

  res.send(responsePizza);
});




// Function to generate a unique user ID
const generateUserId = () => crypto.randomUUID();

/**
 * GET all orders for a specific user
 */
server.get("/api/orders", async function getOrders(req, res) {
  try {
    const userId = req.headers["x-user-id"];
    if (!userId) {
      return res.status(400).send({ error: "User ID required" });
    }

    const orders = await db.all(
      "SELECT order_id, date, time FROM orders WHERE user_id = ? ORDER BY order_id DESC",
      [userId]
    );

    res.send(orders);
  } catch (err) {
    console.error(err);
    res.status(500).send({ error: "Failed to fetch orders" });
  }
});

/**
 * GET details of a specific order (with order items)
 */
server.get("/api/order", async function getOrder(req, res) {
  try {
    const userId = req.headers["x-user-id"];
    const id = req.query.id;

    if (!userId) {
      return res.status(400).send({ error: "User ID required" });
    }
    if (!id) {
      return res.status(400).send({ error: "Order ID required" });
    }

    const orderPromise = db.get(
      "SELECT order_id, date, time FROM orders WHERE order_id = ? AND user_id = ?",
      [id, userId]
    );

    const orderItemsPromise = db.all(
      `SELECT 
        t.pizza_type_id as pizzaTypeId, 
        t.name, 
        t.category, 
        t.ingredients as description, 
        o.quantity, 
        p.price, 
        o.quantity * p.price as total, 
        p.size
      FROM 
        order_details o
      JOIN pizzas p ON o.pizza_id = p.pizza_id
      JOIN pizza_types t ON p.pizza_type_id = t.pizza_type_id
      WHERE 
        o.order_id = ?`,
      [id]
    );

    const [order, orderItemsRes] = await Promise.all([
      orderPromise,
      orderItemsPromise,
    ]);

    if (!order) {
      return res.status(404).send({ error: "Order not found or unauthorized" });
    }

    const orderItems = orderItemsRes.map((item) =>
      Object.assign({}, item, {
        image: `/pizzas/${item.pizzaTypeId}.webp`,
        quantity: +item.quantity,
        price: +item.price,
      })
    );

    const total = orderItems.reduce((acc, item) => acc + item.total, 0);

    res.send({
      order: Object.assign({ total }, order),
      orderItems,
    });
  } catch (err) {
    console.error(err);
    res.status(500).send({ error: "Failed to fetch order details" });
  }
});

/**
 * POST Create a new order with user_id
 */
server.post("/api/order", async function createOrder(req, res) {
  const { cart } = req.body;
  let userId = req.headers["x-user-id"];

  if (!userId) {
    userId = generateUserId(); // Generate user ID if missing
  }

  const now = new Date();
  const time = now.toLocaleTimeString("en-US", { hour12: false });
  const date = now.toISOString().split("T")[0];

  if (!cart || !Array.isArray(cart) || cart.length === 0) {
    return res.status(400).send({ error: "Invalid order data" });
  }

  try {
    await db.run("BEGIN TRANSACTION");

    // Insert the new order with user_id
    const result = await db.run(
      "INSERT INTO orders (date, time, user_id) VALUES (?, ?, ?)",
      [date, time, userId]
    );
    const orderId = result.lastID;

    // Process cart items
    const mergedCart = cart.reduce((acc, item) => {
      const id = item.pizza.id;
      const size = item.size.toLowerCase();
      if (!id || !size) {
        throw new Error("Invalid item data");
      }
      const pizzaId = `${id}_${size}`;

      if (!acc[pizzaId]) {
        acc[pizzaId] = { pizzaId, quantity: 1 };
      } else {
        acc[pizzaId].quantity += 1;
      }

      return acc;
    }, {});

    // Insert order details
    for (const item of Object.values(mergedCart)) {
      const { pizzaId, quantity } = item;
      await db.run(
        "INSERT INTO order_details (order_id, pizza_id, quantity) VALUES (?, ?, ?)",
        [orderId, pizzaId, quantity]
      );
    }

    await db.run("COMMIT");

    res.send({ orderId, userId });
  } catch (error) {
    console.error(error);
    await db.run("ROLLBACK");
    res.status(500).send({ error: "Failed to create order" });
  }
});


server.get("/api/past-orders", async function getPastOrders(req, res) {
  try {
    const userId = req.headers["x-user-id"];
    if (!userId) {
      return res.status(400).send({ error: "User ID required" });
    }

    const page = parseInt(req.query.page, 10) || 1;
    const limit = 20;
    const offset = (page - 1) * limit;

    const pastOrders = await db.all(
      "SELECT order_id, date, time FROM orders WHERE user_id = ? ORDER BY order_id DESC LIMIT ? OFFSET ?",
      [userId, limit, offset]
    );

    res.send(pastOrders);
  } catch (error) {
    console.error(error);
    res.status(500).send({ error: "Failed to fetch past orders" });
  }
});

server.get("/api/past-order/:order_id", async function getPastOrder(req, res) {
  const orderId = req.params.order_id;
  const userId = req.headers["x-user-id"];

  if (!userId) {
    return res.status(400).send({ error: "User ID required" });
  }

  try {
    const order = await db.get(
      "SELECT order_id, date, time FROM orders WHERE order_id = ? AND user_id = ?",
      [orderId, userId]
    );

    if (!order) {
      return res.status(404).send({ error: "Order not found or unauthorized" });
    }

    const orderItems = await db.all(
      `SELECT 
        t.pizza_type_id as pizzaTypeId, t.name, t.category, t.ingredients as description, o.quantity, p.price, o.quantity * p.price as total, p.size
      FROM 
        order_details o
      JOIN
        pizzas p
      ON
        o.pizza_id = p.pizza_id
      JOIN
        pizza_types t
      ON
        p.pizza_type_id = t.pizza_type_id
      WHERE 
        order_id = ?`,
      [orderId]
    );

    const formattedOrderItems = orderItems.map((item) =>
      Object.assign({}, item, {
        image: `/pizzas/${item.pizzaTypeId}.webp`,
        quantity: +item.quantity,
        price: +item.price,
      })
    );

    const total = formattedOrderItems.reduce(
      (acc, item) => acc + item.total,
      0
    );

    res.send({
      order: Object.assign({ total }, order),
      orderItems: formattedOrderItems,
    });
  } catch (error) {
    console.error(error);
    res.status(500).send({ error: "Failed to fetch order" });
  }
});





server.post("/api/contact", async function contactForm(req, res) {
  const { name, email, message } = req.body;

  if (!name || !email || !message) {
    res.status(400).send({ error: "All fields are required" });
    return;
  }

  req.log.info(`Contact Form Submission:
    Name: ${name}
    Email: ${email}
    Message: ${message}
  `);

  res.send({ success: "Message received" });
});

const start = async () => {
  try {
    await server.listen({ host: HOST, port: PORT });
    console.log(`Server listening on port ${PORT}`);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
};

start();




// Run the cron job every day at midnight (00:00)


