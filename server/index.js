const express = require("express");
const cors = require("cors");
const app = express(); // Use express() to create an instance of the Express app
const userRoute = require("./routes/userRoute");
const adminRoute = require("./routes/adminRoute");
const doctorRoute = require("./routes/doctorRoute");
const dotenv = require("dotenv");
const path = require("path");
const connectDB = require("./config/config");
const cloudinary =require ('cloudinary') ;



// MongoDB connection
connectDB();

// Dotenv config
dotenv.config();

          
cloudinary.v2.config({ 
  cloud_name: 'dyvmqs56r', 
  api_key: '662229676537357', 
  api_secret: 'Cy34_Payi7dgrEpREF5-TTHvugM' 
});

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true,limit:"500mb" }));
app.use(express.static(path.join(__dirname, "public")));
app.use(cors({
  origin: 'http://localhost:3000',
  credentials: true,
  methods: 'GET,HEAD,PUT,PATCH,POST,DELETE',
  preflightContinue: false,
  optionsSuccessStatus: 204,
}));

app.use(function(req, res, next) {
  res.header('Cache-Control', 'no-cache, no-store');
  next();
});

// Register partial route setup
app.use(express.static(__dirname + '/public'));
app.use("/images", express.static("images"));

// Routes
app.use("/", userRoute);
app.use("/doctor", doctorRoute);
app.use("/admin", adminRoute);


const PORT = process.env.PORT || 5000;

app.listen(PORT, function () {
  console.log(`Server is running in ${process.env.NODE_ENV} mode on port ${PORT}`);
});
