import React from "react";
import { createRoot } from "react-dom/client";
import App from "./app.jsx";

const el = document.getElementById("root");
createRoot(el).render(React.createElement(App));
