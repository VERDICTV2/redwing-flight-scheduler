# Redwing Flight Scheduler (Hub Ops Visualizer)

![Hub Ops Visualizer Preview](public/preview.png)

A high-performance React application for visualizing flight schedules, managing hub operations, and detecting conflicts in real-time. Built for efficiency and style.

## 🚀 Features

-   **Interactive Timeline**: Visualize flight departures and arrivals with minute-level precision.
-   **Conflict Detection**: Real-time detection of pad overlaps and schedule conflicts.
-   **Smart Parsing**:
    -   Paste raw text or upload PDFs/CSVs.
    -   Automatically extracts flight times, aircraft IDs, pads, operators, and crew names.
    -   Handles unstructured data formats intelligently.
-   **View Modes**: Toggle between "By Pad" and "By Aircraft" views.
-   **Stress Testing**: Built-in tools to simulate high-load scenarios (2k-5k flights) for performance benchmarking.
-   **Modern UI**: Sleek, minimalist interface built with Tailwind CSS v4.

## 🛠️ Tech Stack

-   **Frontend**: React 19, Vite
-   **Styling**: Tailwind CSS v4
-   **Icons**: Lucide React
-   **PDF Processing**: PDF.js
-   **Environment**: WSL 2 (Ubuntu 22.04), Node.js v22

## 📦 Installation & Setup

1.  **Clone the repository**:
    ```bash
    git clone https://github.com/VERDICTV2/redwing-flight-scheduler.git
    cd redwing-flight-scheduler
    ```

2.  **Install dependencies**:
    ```bash
    npm install
    ```

3.  **Run locally**:
    ```bash
    npm run dev
    ```
    Open `http://localhost:5173` to view the app.

4.  **Build for production**:
    ```bash
    npm run build
    npx vite preview
    ```

## ☁️ Deployment

### Deploy to Vercel (Recommended)

This project is optimized for Vercel.

1.  Push your code to GitHub.
2.  Go to [Vercel](https://vercel.com) and import your repository (`VERDICTV2/redwing-flight-scheduler`).
3.  Vercel will detect **Vite** automatically.
4.  **Build Command**: `npm run build`
5.  **Output Directory**: `dist`
6.  Click **Deploy**.

*Note: The `DevTools` panel used for stress testing is automatically disabled in production builds.*

## 🧪 Testing

The app includes a hidden Developer Tools panel for generating stress-test data.
-   **In Development**: Click the 🐞 (Bug icon) in the header to open the panel.
-   **Capabilities**: Generate 5,000+ overlapping flights to test rendering performance.

## 📄 License

MIT License.
