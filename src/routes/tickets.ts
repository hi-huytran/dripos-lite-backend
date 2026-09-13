import { Router } from "express";
import * as ticketsService from "../services/ticketsService";
import { ValidationError } from "../services/ticketsService";

const router = Router();

router.post("/", async (req, res) => {
  try {
    const ticket = await ticketsService.createTicket(req.body);
    res.json(ticket);
  } catch (err) {
    if (err instanceof ValidationError) {
      return res.status(400).json({ error: err.message });
    }
    console.error(err);
    res.status(500).json({ error: "Failed to create ticket" });
  }
});

router.get("/", async (_req, res) => {
  try {
    const tickets = await ticketsService.listTickets();
    res.json(tickets);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to fetch tickets" });
  }
});

router.get("/:id", async (req, res) => {
  try {
    const ticket = await ticketsService.getTicketById(req.params.id);

    if (!ticket) {
      return res.status(404).json({ error: "Ticket not found" });
    }

    res.json(ticket);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to fetch ticket" });
  }
});

router.post("/:id/payments", async (req, res) => {
  try {
    const result = await ticketsService.addPayment(req.params.id, req.body);

    if (!result) {
      return res.status(404).json({ error: "Ticket not found" });
    }

    res.json(result);
  } catch (err) {
    if (err instanceof ValidationError) {
      return res.status(400).json({ error: err.message });
    }
    console.error(err);
    res.status(500).json({ error: "Failed to record payment" });
  }
});

export default router;
