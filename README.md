# 🍕 Fastify Pizza Ordering API

## 🚀 Overview
This is a high-performance **Fastify-based REST API** for a pizza ordering system. It provides endpoints for fetching pizza listings, placing orders, retrieving past orders, and handling customer inquiries. The API uses **SQLite** for data storage and follows RESTful principles for efficient data handling.

---
## 📌 Features
✅ **Pizza Listings**: View available pizzas with descriptions, sizes, and prices.  
✅ **Pizza of the Day**: Get a unique daily featured pizza.  
✅ **Order Management**: Place, retrieve, and list past orders.  
✅ **Contact Form**: Capture customer inquiries.  
✅ **CORS Support**: Enables cross-origin requests.  
✅ **Optimized Queries**: Uses `Promise.all()` for parallel database queries.  
✅ **Secure Transactions**: Ensures data integrity with SQLite transactions.  

---
## 🛠️ Tech Stack
- **Fastify** – A fast and lightweight web framework.
- **SQLite** – Embedded database for storing pizza data and orders.
- **Promised-SQLite3** – Asynchronous SQLite wrapper.
- **pino-pretty** – Logging tool for better debugging.

---
## 🔌 Installation & Setup
### 1️⃣ Clone the Repository
```sh
 git clone https://github.com/your-username/fastify-pizza-api.git
 cd fastify-pizza-api
```

### 2️⃣ Install Dependencies
```sh
 npm install
```

### 3️⃣ Start the Server
```sh
 npm start
```
The server runs on **`http://localhost:3000`** by default.

> If deploying on **Render**, it automatically binds to `0.0.0.0`.

---
## 🔍 API Endpoints

### 🍕 Fetch All Pizzas
```http
GET /api/pizzas
```
📌 Returns a list of all available pizzas with descriptions, sizes, and prices.

### 🌟 Get Pizza of the Day
```http
GET /api/pizza-of-the-day
```
📌 Fetches a unique **daily featured pizza** based on the current date.

### 📦 Retrieve All Orders
```http
GET /api/orders
```
📌 Returns all placed orders with their details.

### 📜 Fetch Order Details
```http
GET /api/order?id=<order_id>
```
📌 Retrieves order details, including pizza names, sizes, and total price.

### 🛒 Place an Order
```http
POST /api/order
```
📌 Requires a `cart` array in the request body:
```json
{
  "cart": [
    { "pizza": { "id": 1 }, "size": "medium" },
    { "pizza": { "id": 2 }, "size": "large" }
  ]
}
```
✅ Returns an `orderId` upon success.

### 🕰️ Get Past Orders (Paginated)
```http
GET /api/past-orders?page=1
```
📌 Fetches past orders with pagination (default 10 orders per page).

### 📑 Get Past Order Details
```http
GET /api/past-order/:order_id
```
📌 Retrieves a detailed breakdown of a past order.

### 📩 Contact Form Submission
```http
POST /api/contact
```
📌 Send a customer inquiry:
```json
{
  "name": "John Doe",
  "email": "john@example.com",
  "message": "I love your pizzas!"
}
```
✅ Logs the message and returns success.

---
## ⚡ Database Schema
### **`pizza_types`** (Pizza menu)
| Column       | Type    | Description            |
|-------------|--------|------------------------|
| pizza_type_id | INT    | Unique identifier    |
| name         | TEXT   | Pizza name            |
| category     | TEXT   | Type (Veg/Non-Veg)    |
| ingredients  | TEXT   | Ingredients list      |

### **`pizzas`** (Size & price mapping)
| Column         | Type    | Description       |
|---------------|--------|-------------------|
| pizza_id      | INT    | Unique pizza ID   |
| pizza_type_id | INT    | Links to `pizza_types` |
| size          | TEXT   | Size (S/M/L)      |
| price         | REAL   | Price of pizza    |

### **`orders`** (Order records)
| Column     | Type    | Description       |
|-----------|--------|-------------------|
| order_id  | INT    | Unique order ID   |
| date      | TEXT   | Order date        |
| time      | TEXT   | Order time        |

### **`order_details`** (Ordered items)
| Column     | Type    | Description        |
|-----------|--------|--------------------|
| order_id  | INT    | Links to `orders`  |
| pizza_id  | INT    | Ordered pizza      |
| quantity  | INT    | Number of items    |

---
## 🛡️ Security & Performance
✅ **CORS Handling**: Allows cross-origin requests for frontend compatibility.  
✅ **Database Transactions**: Uses `BEGIN TRANSACTION` and `COMMIT` to ensure safe order processing.  
✅ **Efficient Queries**: Uses `Promise.all()` for simultaneous database calls.  
✅ **Error Handling**: Catches and logs errors gracefully.

---
## 🎯 Future Enhancements
- ✅ User authentication for order tracking.
- ✅ Admin dashboard for order management.
- ✅ WebSocket integration for real-time order status updates.

---
👨‍💻 **Developed by [Lokeshwar Reddy Karra](https://github.com/lokeshkarra)**

