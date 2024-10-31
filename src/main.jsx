import * as React from "react";
import { createRoot } from "react-dom/client";
import {
  createBrowserRouter,
  RouterProvider,
  Route,
  Link,
} from "react-router-dom";
import './index.css'
import AppP from "./P";
import './particle.css'
const router = createBrowserRouter([
  {
    path: "/",
    element: (
   <div>   <AppP/></div>
    ),
  },
]);

createRoot(document.getElementById("root")).render(
  <RouterProvider router={router} />
);