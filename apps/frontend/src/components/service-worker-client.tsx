'use client';

import { useEffect } from "react";

const ServiceWorkerClient = () => {
  useEffect(() => {
    if (typeof window === "undefined" || !("serviceWorker" in navigator)) {
      return;
    }

    if (process.env.NODE_ENV === "production") {
      navigator.serviceWorker
        .register("/sw.js")
        .catch(error => console.error("Service worker registration failed", error));
    }
  }, []);

  return null;
};

export default ServiceWorkerClient;
