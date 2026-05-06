#  Lahm Farm: Enterprise E-Commerce & ERP System

A full-stack, enterprise-level web application designed to digitize the entire lifecycle of a modern livestock farm. This system bridges the gap between B2C online shopping, B2B corporate supplies, and complex internal logistics, offering a massive ERP dashboard to manage operations, accounting, and human resources in real-time.

---

##  Key Features

###  1. E-Commerce Store (B2C)
* **Dynamic Pricing Engine:** Calculates livestock prices based on live weight, selected customizations (slaughtering, cutting, packaging), and location-based delivery fees.
* **Shared Purchases (نظام الأسهم):** Allows customers to buy "shares" in large animals (e.g., Cows, Camels) with an automatic fulfillment algorithm triggered once the animal is fully funded.
* **Smart Cart & Checkout:** Real-time deposit calculation based on cart items, fully integrated with **Paymob** (Visa/Wallets) for secure transactions.

###  2. Corporate Portal (B2B)
* **Dedicated Supply Workflow:** A specialized portal for restaurants and hotels to request bulk quotes.
* **Contract Management:** Enables seamless price negotiation and management of active supply contracts and installments.

###  3. ERP & Management Dashboard (Admin & Staff)
* **Smart Assistant (AI Dispatcher):** Automatically analyzes pending orders and generates optimized daily execution plans for butchers, drivers, and external suppliers.
* **Logistics & Fleet Management:** Live GPS tracking for delivery vehicles and OTP-based secure delivery handoffs.
* **Real-Time Communication:** Internal Live Chat built with WebSockets, featuring strict Role-Based Access Control (RBAC).
* **Accounting & HR:** Complete double-entry journal system, daily attendance tracking, payroll management, and comprehensive P&L (Profit & Loss) reports.
* **Messaging Manager:** Broadcast SMS, Push Notifications, and Emails directly to targeted customer segments.

---

##  Tech Stack

### Backend
* **Python / Django / Django Rest Framework (DRF)**
* **PostgreSQL** (Primary Database)
* **Redis & Celery** (Caching & Asynchronous Tasks)
* **Django Channels** (WebSockets for real-time Chat & Live Tracking)

### Frontend
* **React.js & Vite**
* **Tailwind CSS & React-Bootstrap** (Responsive UI/UX)
* **Recharts** (Data Visualization)

### DevOps & Integrations
* **Infrastructure:** Docker, Docker Compose, Nginx
* **Payments:** Paymob API
* **Communications:** SMS Gateways (WhySMS, ArpuPlus), WebPush Notifications

---

##  System Demo & Previews

 **[Click here to watch the full system demo video]** *(Replace this text with your YouTube Unlisted Link)*

### Screenshots
*(Add your screenshots below in GitHub by dragging and dropping the images here)*

1. **Storefront & B2C Experience:**
[Drop image here]

2. **ERP Dashboard & Financial Analytics:**
[Drop image here]

3. **Smart Dispatcher & Driver Tracking:**[Drop image here]

---
*Developed by [Your Name]*
