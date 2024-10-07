import './navbar.css';

export const Nav = () => {
    const html = String.raw;
    return html`
        <div class="navbar">
            <div class="navbar-logo">
                <img class="" width="32" height="32" src="./public/favicon.png" alt="Logo" />
                <p>Kenya Court Cases App</p>
            </div>
            <div class="navbar-items">
                <ul>
                    <li>
                        <a href="#">
                            Home
                        </a>
                    </li>
                    <li>
                        <a href="#/about">
                            Advocates
                        </a>
                    </li>
                    <li>
                        <a href="#/judges">
                            Judges
                        </a>
                    </li>
                    <li>
                        <a href="#/cases">
                            Cases
                        </a>
                    </li>
                    <li>
                        <button>Log In</button>
                    </li>
                </ul>
            </div>
        </div>
    `;
}