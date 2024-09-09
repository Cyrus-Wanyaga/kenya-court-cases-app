import { Advocate } from "../models/index.js";
import { Request, Response } from "express";

const getAllAdvocates = async (req: Request, res: Response): Promise<void> => {
    try {
        const advocates = await Advocate.findAll();
        res.json(advocates);
    } catch (err: any) {
        console.log(err);
        res.status(500).json({ err: err.message });
    }
}

export default {
    getAllAdvocates
}