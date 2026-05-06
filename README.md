#  Lahm Farm: Enterprise E-Commerce & ERP System

A full-stack, enterprise-level web application designed to digitize the entire lifecycle of a modern livestock farm. This system bridges the gap between B2C online shopping, B2B corporate supplies, and complex internal logistics, offering a massive ERP dashboard to manage operations, accounting, and human resources in real-time.

 **Developed by:** [Saleh Mohamed](https://www.linkedin.com/in/sale7-mohamed/)

---

##  Key Features

###  1. E-Commerce Store (B2C)
* **Dynamic Pricing Engine:** Calculates livestock prices based on live weight, selected customizations (slaughtering, cutting, packaging), and location-based delivery fees.
* **Shared Purchases :** Allows customers to buy "shares" in large animals (e.g., Cows, Camels) with an automatic fulfillment algorithm triggered once the animal is fully funded.
* **Smart Cart & Checkout:** Real-time deposit calculation based on cart items, fully integrated with **Paymob** (Visa/Wallets) for secure transactions.

###  2. Corporate Portal (B2B)
* **Dedicated Supply Workflow:** A specialized portal for restaurants and hotels to request bulk quotes.
* **Contract Management:** Enables seamless price negotiation and management of active supply contracts and installments.

###  3. ERP & Management Dashboard (Admin & Staff)
* **Smart Assistant (AI Dispatcher):** Automatically analyzes pending orders and generates optimized daily execution plans for butchers, drivers, and external suppliers.
* **Logistics & Fleet Management:** Live GPS tracking for delivery vehicles and OTP-based secure delivery handoffs.
* **Real-Time Communication:** Internal Live Chat built with WebSockets, featuring strict Role-Based Access Control (RBAC).
* **Accounting & HR:** Complete double-entry journal system, daily attendance tracking, payroll management, and comprehensive P&L (Profit & Loss) reports.

---

##  Tech Stack

* **Backend:** Python, Django, Django Rest Framework (DRF), PostgreSQL, Redis, Celery.
* **Frontend:** React.js, Vite, Tailwind CSS, React-Bootstrap, Recharts.
* **Real-Time:** Django Channels (WebSockets) for Chat & Live Tracking.
* **Integrations:** Docker, Nginx, Paymob API, SMS Gateways (WhySMS, ArpuPlus), WebPush.

---

##  System Previews

**1. Storefront & B2C Experience:**

<img width="1919" height="1079" alt="done1" src="https://github.com/user-attachments/assets/fa534c98-451c-40c8-811f-bcb273f0a434" />

**2. ERP Dashboard & Financial Analytics:**

<img width="1919" height="1079" alt="done2" src="https://github.com/user-attachments/assets/eb5009c2-66bd-42ea-8c0f-2f4c71b6b640" />

**3. Real-Time Chat & Operations:**

<img width="1919" height="1079" alt="done3" src="https://github.com/user-attachments/assets/055aa4bd-0fdf-40c5-8d45-170f8df26984" />
