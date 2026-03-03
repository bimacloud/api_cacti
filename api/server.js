require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const { ipFilter } = require('./src/middleware/ipFilter');
const { auth } = require('./src/middleware/auth');
const { rateLimiter } = require('./src/middleware/rateLimiter');

const deviceController = require('./src/controllers/deviceController');
const trafficController = require('./src/controllers/trafficController');
const popController = require('./src/controllers/popController');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(helmet());
app.use(cors());
app.use(express.json());

app.set('trust proxy', 1);

app.use(ipFilter);
app.use(rateLimiter);
app.use(auth);

const router = express.Router();
router.get('/devices', deviceController.getDevices);
router.get('/device/:id', deviceController.getDeviceById);
router.get('/device/:id/graphs', deviceController.getDeviceGraphs);
router.get('/traffic/:graph_id', trafficController.getTraffic);
router.get('/pop-status', popController.getPopStatus);
router.get('/top-usage', trafficController.getTopUsage);
app.use('/api', router);

app.use((req, res) => res.status(404).json({ error: 'Endpoint Not Found' }));

app.listen(PORT, '127.0.0.1', () => {
    console.log(`Server: Berjalan di port ${PORT}, Mode: ${process.env.NODE_ENV || 'development'}`);
});
