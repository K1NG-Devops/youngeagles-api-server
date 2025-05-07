import express from 'express';
import cors from 'cors';
import authRoutes from './routes/auth.routes.js';

const app = express();
const port = process.env.PORT || 3000 || 8080;

app.use(cors({
  origin: '*', // Allow all origins
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));
app.use(express.urlencoded({ extended: true })); 
app.use(express.json());

app.get('/api', (req, res) => {
  res.json({ message: 'API is running' });
});

app.use('/api/auth', authRoutes);

app.get("/test-db", async (req, res) => {
  try {
    connection.query("SELECT DATABASE()", (err, results) => {
      if (err) throw err;
      res.send(`Connected to database: ${results[0]['DATABASE()']}`);
    });
  } catch (err) {
    res.status(500).send("Database connection failed: " + err.message);
  }
});

app.listen(port, () => {
  console.log(`API server is running on port ${port}`);
}
);

// Middleware to parse incoming requests with JSON payloads
// and URL-encoded payloads
// This is important for handling form submissions and JSON data
// in the request body
// It allows us to access the data in req.body
// without having to parse it manually
// The extended option allows for rich objects and arrays to be encoded into the URL-encoded format
// The default value is false, which means that the library will use the querystring library
// to parse the URL-encoded data