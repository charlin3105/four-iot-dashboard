import mqtt from "mqtt";

const client = mqtt.connect(
  "wss://olivesquash-6c2cedc1.a03.euc1.aws.hivemq.cloud:8884/mqtt",
  {
    clientId: `react_scada_${Math.random().toString(16).slice(2, 10)}`,
    username: "esp32",
    password: "Thermo2026",
    clean: true,
    connectTimeout: 10000,
    reconnectPeriod: 3000,
    keepalive: 30,
    protocolVersion: 4,
  }
);

client.on("connect", () => {
  console.log("✅ Connecté à HiveMQ");
});

client.on("reconnect", () => {
  console.log("🔄 Reconnexion MQTT...");
});

client.on("close", () => {
  console.log("⛔ Connexion MQTT fermée");
});

client.on("offline", () => {
  console.log("📴 MQTT hors ligne");
});

client.on("error", (err) => {
  console.log("❌ MQTT Error :", err?.message || err);
});

export default client;