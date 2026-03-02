The Ultimate "Glassmorphism POS & Courier" Master Prompt (English)
Role: You are a Senior Full-Stack Developer and UI/UX Designer specializing in React, Node.js, and MSSQL.

Project Goal: Build a high-end, professional Point of Sale (POS) and Courier Tracking System. The application must be cross-platform (Web, Desktop via Electron, Mobile via Capacitor) with a Modern Glassmorphism UI.

1. Visual Identity & UI/UX (Glassmorphism):

Theme: Dark/Light mode support with frosted glass backgrounds (backdrop-blur-md), subtle borders (border-white/20), and glowing neon accents (Cyan for POS, Amber for Courier, Emerald for Success).

Layout: A sidebar-based navigation with floating glass cards for data visualization.

Responsiveness: Highly optimized for 15-inch Touchscreen POS terminals and mobile devices for couriers.

2. Technical Architecture:

Frontend: React.js (Vite), Tailwind CSS, Framer Motion (for smooth glass transitions), Lucide React (icons), Recharts (analytics).

Backend: Node.js (Express) with mssql (tedious) driver. Use a Singleton pattern for DB connection pooling.

Real-time: Socket.io for live courier GPS tracking and instant sales notifications.

State Management: Zustand or Redux Toolkit with persist for offline-first capabilities.

3. Database Schema (MSSQL):

Products: (ID, Barcode [indexed], Name, Stock, CostPrice, SalePrice, Category, ImageURL).

Sales: (ID, TotalAmount, Tax, Discount, PaymentMethod [Cash/Card], CourierID [nullable], Timestamp).

SaleItems: (ID, SaleID, ProductID, Qty, UnitPrice).

Couriers: (ID, Name, Phone, Status [Idle/Delivering/Offline], Lat, Lng, DailyDistanceKM).

4. Core Modules to Scaffold:

POS Interface: Left side: Grid of high-frequency products (Quick-tap). Right side: Glass-morphed checkout list with barcode input (auto-focus).

Courier Tracking: Integrated Mapbox/Leaflet map showing live couriers as glowing pulses. Calculate distance using the Haversine formula in the backend.

Owner Dashboard: Glass cards showing:

Total Revenue & Net Profit (Calculated by SalePrice - CostPrice).

Stock Alert (Glass list of low-stock items).

Courier Performance (Orders delivered vs. KM traveled).

5. Deliverables:

Provide a clean, modular Folder Structure.

Write the MSSQL Table Creation Scripts.

Create a Tailwind Config for the Glassmorphism theme (custom blurs and colors).

Provide the Node.js Server Entry Point (Express + MSSQL + Socket.io).

Build a React POS Component with the Glassmorphism style.