


    document.addEventListener('DOMContentLoaded', () => {

    // --- Modal Elements ---
    const authModal = document.getElementById('auth-modal');
    const signinBtn = document.getElementById('signin-btn');
    const signupBtn = document.getElementById('signup-btn');
    const closeBtn = document.querySelector('.close-btn');

    // --- Form View Elements ---
    const signinView = document.getElementById('signin-view');
    const signupView = document.getElementById('signup-view');
    const showSignup = document.getElementById('show-signup');
    const showSignin = document.getElementById('show-signin');

    // --- Form Elements ---
    const signinForm = document.getElementById('signin-form');
    const signupForm = document.getElementById('signup-form');

    // --- Functions to control modal visibility ---
    const openModal = () => {
        authModal.style.display = 'flex';
    };

    const closeModal = () => {
        authModal.style.display = 'none';
    };

    // --- Event Listeners for opening and closing the modal ---
    signinBtn.addEventListener('click', () => {
        openModal();
        signupView.classList.add('hidden');
        signinView.classList.remove('hidden');
    });

    signupBtn.addEventListener('click', () => {
        openModal();
        signinView.classList.add('hidden');
        signupView.classList.remove('hidden');
    });

    closeBtn.addEventListener('click', closeModal);

    // Close modal if user clicks outside the content area
    window.addEventListener('click', (event) => {
        if (event.target === authModal) {
            closeModal();
        }
    });

    // --- Event Listeners for switching between sign-in and sign-up views ---
    showSignup.addEventListener('click', (event) => {
        event.preventDefault();
        signinView.classList.add('hidden');
        signupView.classList.remove('hidden');
    });

    showSignin.addEventListener('click', (event) => {
        event.preventDefault();
        signupView.classList.add('hidden');
        signinView.classList.remove('hidden');
    });


    // --- Form Submission Logic (Simulation) ---

    
});