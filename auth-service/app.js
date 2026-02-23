const express = require('express')
const app = express();
const userRoute = require('./routes/user.route');
const dotenv = require('dotenv');
const path = require('path');
dotenv.config({ path: path.join(__dirname, '.env') });
const cookieParser = require('cookie-parser');
const connect = require('./db/db');
const { metricsMiddleware } = require('./middleware/metrics');
connect();


app.use(express.json());
app.use(cookieParser());
app.use(metricsMiddleware);
//app.use(express.urlencoded({extended : true}))
app.use(userRoute)

module.exports = app; 