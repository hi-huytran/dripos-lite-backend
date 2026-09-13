import express from "express";
import dotenv from "dotenv";
import productsRouter from "./routes/products";
import ticketsRouter from "./routes/tickets";

dotenv.config();

const app = express();
app.use(express.json());

app.get("/health", (_req, res) => {
  res.json({ status: "ok" });
});

app.use("/products", productsRouter);
app.use("/tickets", ticketsRouter);

app.use((_req, res) => {
  res.status(404).json({ error: "Not found" });
});

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`Dripos Lite backend listening on port ${PORT}`);
});
