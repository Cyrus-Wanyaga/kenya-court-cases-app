import { HomePage } from "./js/pages/index.js";
import './styles/styles.css';

let appDiv = document.getElementById("app");

// const root = ReactDOM.createRoot(appDiv);
// root.render(
//   <React.StrictMode>
//     <HomePage />
//   </React.StrictMode>
// );

const routes = [
    { path: '/', action: () => HomePage() },
    { path: '/about', action: () => console.log('About Page Content') }
];

const router = new UniversalRouter(routes);

function handleRouting() {
    const path = window.location.hash.slice(1) || '/';
    console.log('Path is : ', path);

    console.log('Router : ', router);
    router.resolve({ pathname: path })
        .then(content => {
            appDiv.innerHTML = content;
        }).catch(error => {
            appDiv.innerHTML = '404 - Page Not Found';
        });
}

window.addEventListener('popstate', handleRouting);

document.addEventListener('click', function (event) {
    if (event.target.matches('a[data-link]')) { // Assuming you add data-link to your nav links
        event.preventDefault(); // Prevent default anchor behavior
        const path = event.target.getAttribute('href'); // Get the link href
        window.history.pushState({}, '', path); // Change the URL
        handleRouting(); // Call the routing handler
    }
});

handleRouting();

/**
import { HomePage } from "./js/pages/index.js";

const routes = {
    '/': () => HomePage(),  // Call the HomePage function to get the HTML
    '/about': () => '<h1>This is the About Page</h1>', // Example for the About page
};

document.addEventListener('alpine:init', () => {
    Alpine.data('router', () => ({
        init() {
            console.log("Router Initialized");  // This should work now
        },
        currentRoute: window.location.hash.slice(1) || '/',
        
        getContent() {
            const routeFunction = routes[this.currentRoute] || (() => '<h1>404 - Page Not Found</h1>');
            return routeFunction();  // Call the function to get the HTML
        }
    }));
});
 */
