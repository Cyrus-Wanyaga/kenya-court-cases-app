import { Nav } from "../components/nav/index.js";

export const HomePage = () => {
    const html = String.raw;
    return html`
        ${Nav()}
        <h1>This is the Index page</h1>
    `;
};