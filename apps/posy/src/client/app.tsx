import { useEffect, useState } from "react";

interface HealthResponse {
  status: string;
}

export function App() {
  const [status, setStatus] = useState("...");

  useEffect(() => {
    fetch("/health")
      .then(async (res) => res.json() as Promise<HealthResponse>)
      .then((data) => {
        setStatus(data.status);
      })
      .catch(() => {
        setStatus("offline");
      });
  }, []);

  return (
    <main>
      <h1>Posy</h1>
      <p>server: {status}</p>
    </main>
  );
}
