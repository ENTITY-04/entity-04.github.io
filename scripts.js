// Initialize site interactions once DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    const commentForm = document.getElementById('commentForm');
    const commentAlert = document.getElementById('commentAlert');

    if (commentForm && commentAlert) {
        // Simulate submission feedback and celebrate with paw confetti
        commentForm.addEventListener('submit', (event) => {
            event.preventDefault();
            commentAlert.classList.remove('d-none');
            commentForm.reset();
            releasePawConfetti(commentAlert);
        });
    }

    const animatedElements = document.querySelectorAll('[data-animate]');
    if (animatedElements.length) {
        // Reveal sections gently as they enter the viewport
        const observer = new IntersectionObserver((entries, obs) => {
            entries.forEach((entry) => {
                if (entry.isIntersecting) {
                    entry.target.classList.add('is-visible');
                    obs.unobserve(entry.target);
                }
            });
        }, {
            threshold: 0.2,
            rootMargin: '0px 0px -40px 0px'
        });

        animatedElements.forEach((element) => observer.observe(element));
    }
});

// Spawn a quick paw emoji animation near the provided container
function releasePawConfetti(container) {
    const paw = document.createElement('span');
    paw.textContent = '🐾';
    paw.style.position = 'absolute';
    paw.style.fontSize = '1.75rem';
    paw.style.animation = 'pawPop 1.2s ease-out forwards';
    paw.style.pointerEvents = 'none';
    paw.style.transform = 'translate(-50%, 0)';
    const rect = container.getBoundingClientRect();
    paw.style.left = `${rect.left + rect.width / 2}px`;
    paw.style.top = `${rect.top}px`;
    document.body.appendChild(paw);
    setTimeout(() => paw.remove(), 1200);
}
