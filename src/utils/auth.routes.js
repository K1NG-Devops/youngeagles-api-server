import express from 'express';
import { verifyToken } from './jwt.js';

const router = express.Router();

// Other auth routes (register, login, etc.) would go here

router.get('/dashboard', verifyToken, (req, res) => {
    res.json({ name: req.user.name });
});

export default router;