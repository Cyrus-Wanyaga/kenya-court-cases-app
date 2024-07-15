import express, { Application, Request, Response } from 'express';
import bodyParser from 'body-parser';
import cors from 'cors';
import { Worker } from 'node:worker_threads';
import sequelize from './middleware/sequelize.js';

const app: Application = express();

app.use(bodyParser.json());
app.use(cors());

app.get('/', (req: Request, resp: Response) => {
    resp.json({ statusMessage: "Hello World!" });
});

const dbConnect = async (): Promise<boolean> => {
    try {
        await sequelize.authenticate();

        await sequelize.sync();

        console.log('Database connection established successfully');
        return true;
    } catch (error) {
        console.error('Unable to connect to the database:', error);
        return false;
    }
};

const isConnectedToDb = await dbConnect();

if (isConnectedToDb) {
    const scraperWorker = new Worker('./dist/scraper/index.js');

    scraperWorker.on('message', (message) => {
        if (message === 'scraping-completed') {
            console.log('Scraping service completed its task.');
        }
    });

    scraperWorker.postMessage('start-scraping');
}

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Application server is now running on port ${PORT}`);
});

export default app;