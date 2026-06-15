import mqtt from "mqtt";

const client = mqtt.connect(
  "wss://olivesquash-6c2cedc1.a03.euc1.aws.hivemq.cloud:8884/mqtt",
  {
    username: "esp32",
    password: "Thermo2026",
  }
);

client.on("connect", () => {
  console.log("✅ Connecté à HiveMQ");
});

client.on("error", (err) => {
  console.log("❌ MQTT Error :", err);
});

export default client;