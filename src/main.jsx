import * as React from "react";
import { createRoot } from "react-dom/client";
import {
  createBrowserRouter,
  RouterProvider,
  Route,
  Link,
} from "react-router-dom";
import './index.css'
import App from './App'
import AppP from "./P";
import './particle.css'
const router = createBrowserRouter([
  {
    path: "/home",
    element: (
   <div>   <App/></div>
    ),
  },
  {
    path: "/Faucet",
    element: (
   <div>   <AppP/></div>
    ),
  },
  {
    path: "about",
    element: <div>About</div>,
  },
]);

createRoot(document.getElementById("root")).render(
  <RouterProvider router={router} />
);