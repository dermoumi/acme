import { serve } from "@acme/app/server";
import { createApp } from "./app";

const app = createApp();

export default serve(app);
