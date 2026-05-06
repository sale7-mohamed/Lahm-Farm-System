# Lahm Farm: Enterprise E-Commerce & ERP System

A full-stack, enterprise-level web application designed to digitize the entire lifecycle of a livestock farm. It combines a **B2C E-Commerce store**, a **B2B Corporate Portal**, and a massive **ERP Dashboard** to manage operations, logistics, accounting, and human resources.

## Key Features

### 1. E-Commerce Store (B2C)

- **Dynamic Pricing Engine:** Calculates livestock prices based on live weight, selected services (slaughtering, cutting, packaging), and location-based delivery fees.
- **Shared Purchases (الأسهم):** Allows customers to buy "shares" in large animals (e.g., Cows, Camels) with automatic fulfillment once the animal is fully funded.
- **Smart Cart & Checkout:** Real-time deposit calculation and Paymob integration (Visa/Wallets).

### 2. Corporate Portal (B2B)

- Dedicated portal for restaurants and hotels to request bulk quotes, negotiate prices, and manage active supply contracts.

### 3. ERP & Management Dashboard (Admin & Staff)

- **Logistics & Fleet:** Live GPS tracking for delivery vehicles and OTP-based secure delivery handoffs.
- **Smart Assistant (AI Dispatcher):** Automatically analyzes pending orders and generates daily execution plans for butchers, drivers, and external suppliers.
- **Accounting & HR:** Complete double-entry journal system, daily attendance, payroll management, and P&L reports.
- **Internal Live Chat:** Real-time WebSocket-based messaging system for employees with strict Role-Based Access Control (RBAC).
- **Messaging Manager:** Broadcast SMS, Push Notifications, and Emails directly to targeted customer segments.

## Tech Stack

- **Backend:** Python, Django, Django Rest Framework (DRF), PostgreSQL, Redis, Celery.
- **Frontend:** React.js, Vite, Tailwind CSS, React-Bootstrap, Recharts.
- **Real-Time:** Django Channels (WebSockets) for Chat & Live Tracking.
- **DevOps:** Docker, Docker Compose, Nginx.
- **Integrations:** Paymob (Payments), SMS Gateways (WhySMS, ArpuPlus), WebPush.

## System Previews

_(Upload 3-4 screenshots here: Storefront, Dashboard Analytics, Driver Tracking)_
