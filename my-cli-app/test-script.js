// Test JavaScript file with baseline features

async function fetchData() {
    try {
        const response = await fetch('/api/data');
        const data = await response.json();
        return data;
    } catch (error) {
        console.error('Fetch failed:', error);
    }
}

// Web Storage
localStorage.setItem('user', 'test');

// Modern APIs
const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
        if (entry.isIntersecting) {
            console.log('Element visible');
        }
    });
});

// Promise usage
Promise.all([
    fetch('/api/users'),
    fetch('/api/posts')
]).then(responses => {
    console.log('All requests completed');
});