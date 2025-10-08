// Check URL parameters for game mode
const urlParams = new URLSearchParams(window.location.search);
const GAME_MODE = urlParams.get('mode') === 'comparison' ? 'comparison' : 'single';
// URL examples:
// index.html (default single mode)
// index.html?mode=comparison (comparison mode)

class RealOrFakeGame {
    constructor() {
        this.mode = GAME_MODE;
        this.score = 0;
        this.totalImages = 0;
        this.currentImageIndex = 0;
        this.allImages = [];
        this.shuffledImages = [];
        this.currentAnswer = null;
        this.gameComplete = false;

        this.elements = {
            gameArea: document.getElementById('gameArea'),
            buttons: document.getElementById('buttons'),
            btnReal: document.getElementById('btnReal'),
            btnFake: document.getElementById('btnFake'),
            score: document.getElementById('score'),
            total: document.getElementById('total'),
            feedback: document.getElementById('feedback'),
            loading: document.getElementById('loading'),
            background: document.getElementById('background'),
            backgroundLeft: document.getElementById('backgroundLeft'),
            backgroundRight: document.getElementById('backgroundRight'),
            instructions: document.getElementById('instructions')
        };

        this.init();
    }

    async init() {
        await this.loadImages();
        this.setupEventListeners();
        this.startGame();
    }

    async loadImages() {
        try {
            // Use static data instead of API call
            const data = window.IMAGES_DATA;

            this.allImages = [...data.real, ...data.fake];
            this.shuffledImages = this.shuffleArray([...this.allImages]);

            if (this.mode === 'single') {
                this.totalImages = this.shuffledImages.length;
            } else if (this.mode === 'comparison') {
                // In comparison mode, total is limited by the smaller set
                this.totalImages = Math.min(data.real.length, data.fake.length);
            }

            this.elements.total.textContent = this.totalImages;

            if (this.totalImages === 0) {
                this.elements.loading.textContent = 'No images found! Please add images to the real and fake folders.';
                return;
            }

        } catch (error) {
            console.error('Error loading images:', error);
            this.elements.loading.textContent = 'Error loading images!';
        }
    }

    shuffleArray(array) {
        const shuffled = [...array];
        for (let i = shuffled.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
        }
        return shuffled;
    }

    setupEventListeners() {
        this.elements.btnReal.addEventListener('click', () => this.makeGuess('real'));
        this.elements.btnFake.addEventListener('click', () => this.makeGuess('fake'));
    }

    startGame() {
        if (this.totalImages === 0) return;

        this.elements.loading.style.display = 'none';

        if (this.mode === 'single') {
            this.elements.buttons.style.display = 'flex';
            this.elements.instructions.style.display = 'none';
        } else if (this.mode === 'comparison') {
            this.elements.buttons.style.display = 'none';
            this.elements.instructions.style.display = 'block';
        }

        this.showNextImage();
    }

    async showNextImage() {
        if (this.mode === 'single' && this.currentImageIndex >= this.shuffledImages.length) {
            this.endGame();
            return;
        } else if (this.mode === 'comparison' && this.currentImageIndex >= this.totalImages) {
            this.endGame();
            return;
        }

        this.disableButtons(true);
        this.elements.feedback.textContent = '';
        this.elements.feedback.className = 'feedback';

        if (this.mode === 'single') {
            await this.showSingleImage();
        } else if (this.mode === 'comparison') {
            await this.showComparisonImages();
        }

        this.disableButtons(false);
    }

    async showSingleImage() {
        const currentImage = this.shuffledImages[this.currentImageIndex];
        this.currentAnswer = currentImage.type;

        const imageContainer = document.createElement('div');
        imageContainer.className = 'image-container single-image-container';

        const img = document.createElement('img');
        img.className = 'game-image';
        img.src = `images/${currentImage.type}/${currentImage.file}`;

        await this.loadImagePromise(img);

        imageContainer.appendChild(img);

        this.elements.gameArea.innerHTML = '';
        this.elements.gameArea.appendChild(imageContainer);

        await this.updateBackground(img.src);
    }

    async showComparisonImages() {
        const realImages = this.shuffledImages.filter(img => img.type === 'real');
        const fakeImages = this.shuffledImages.filter(img => img.type === 'fake');

        if (this.currentImageIndex >= Math.min(realImages.length, fakeImages.length)) {
            this.endGame();
            return;
        }

        const realImage = realImages[this.currentImageIndex];
        const fakeImage = fakeImages[this.currentImageIndex];

        const images = [realImage, fakeImage];
        const shuffledPositions = Math.random() < 0.5 ? [0, 1] : [1, 0];

        const leftImg = document.createElement('img');
        leftImg.className = 'game-image';
        leftImg.src = `images/${images[shuffledPositions[0]].type}/${images[shuffledPositions[0]].file}`;
        leftImg.dataset.type = images[shuffledPositions[0]].type;

        const rightImg = document.createElement('img');
        rightImg.className = 'game-image';
        rightImg.src = `images/${images[shuffledPositions[1]].type}/${images[shuffledPositions[1]].file}`;
        rightImg.dataset.type = images[shuffledPositions[1]].type;

        await Promise.all([this.loadImagePromise(leftImg), this.loadImagePromise(rightImg)]);

        const leftContainer = document.createElement('div');
        leftContainer.className = 'image-container';
        leftContainer.style.cursor = 'pointer';
        leftContainer.appendChild(leftImg);

        const rightContainer = document.createElement('div');
        rightContainer.className = 'image-container';
        rightContainer.style.cursor = 'pointer';
        rightContainer.appendChild(rightImg);

        // Add click event listeners for comparison mode
        leftContainer.addEventListener('click', () => this.makeComparisonGuess('left'));
        rightContainer.addEventListener('click', () => this.makeComparisonGuess('right'));

        this.elements.gameArea.innerHTML = '';
        this.elements.gameArea.appendChild(leftContainer);
        this.elements.gameArea.appendChild(rightContainer);

        await this.updateComparisonBackground(leftImg.src, rightImg.src);

        this.currentAnswer = 'comparison';
        this.leftImageType = images[shuffledPositions[0]].type;
        this.rightImageType = images[shuffledPositions[1]].type;
    }

    loadImagePromise(img) {
        return new Promise((resolve, reject) => {
            img.onload = () => {
                resolve();
            };
            img.onerror = (error) => {
                console.error('Failed to load image:', img.src, error);
                reject(error);
            };
        });
    }

    async updateBackground(imageSrc) {
        return new Promise((resolve) => {
            // First, hide all backgrounds
            this.elements.background.classList.remove('loaded');
            this.elements.backgroundLeft.style.display = 'none';
            this.elements.backgroundRight.style.display = 'none';

            // Create a temporary image to preload
            const tempImg = new Image();
            tempImg.onload = () => {
                // Set the background image
                this.elements.background.style.backgroundImage = `url("${imageSrc}")`;
                this.elements.background.style.display = 'block';

                // Trigger the fade-in effect
                setTimeout(() => {
                    this.elements.background.classList.add('loaded');
                    resolve();
                }, 50);
            };
            tempImg.onerror = () => {
                console.error('Failed to load background image:', imageSrc);
                resolve();
            };
            tempImg.src = imageSrc;
        });
    }

    async updateComparisonBackground(leftSrc, rightSrc) {
        return new Promise((resolve) => {
            // Hide single background
            this.elements.background.classList.remove('loaded');
            this.elements.background.style.display = 'none';

            let loadedCount = 0;
            const onImageLoad = () => {
                loadedCount++;
                if (loadedCount === 2) {
                    // Both images loaded, show backgrounds
                    this.elements.backgroundLeft.style.display = 'block';
                    this.elements.backgroundRight.style.display = 'block';

                    setTimeout(() => {
                        this.elements.backgroundLeft.classList.add('loaded');
                        this.elements.backgroundRight.classList.add('loaded');
                        resolve();
                    }, 50);
                }
            };

            // Preload left image
            const tempImgLeft = new Image();
            tempImgLeft.onload = () => {
                this.elements.backgroundLeft.style.backgroundImage = `url("${leftSrc}")`;
                this.elements.backgroundLeft.classList.remove('loaded');
                onImageLoad();
            };
            tempImgLeft.onerror = () => {
                console.error('Failed to load left background image:', leftSrc);
                onImageLoad();
            };
            tempImgLeft.src = leftSrc;

            // Preload right image
            const tempImgRight = new Image();
            tempImgRight.onload = () => {
                this.elements.backgroundRight.style.backgroundImage = `url("${rightSrc}")`;
                this.elements.backgroundRight.classList.remove('loaded');
                onImageLoad();
            };
            tempImgRight.onerror = () => {
                console.error('Failed to load right background image:', rightSrc);
                onImageLoad();
            };
            tempImgRight.src = rightSrc;
        });
    }

    disableButtons(disabled) {
        this.elements.btnReal.disabled = disabled;
        this.elements.btnFake.disabled = disabled;
    }

    makeGuess(guess) {
        let correct = false;

        if (this.mode === 'single') {
            correct = guess === this.currentAnswer;
        }

        if (correct) {
            this.score++;
            this.elements.feedback.textContent = 'Correct!';
            this.elements.feedback.className = 'feedback correct';
        } else {
            this.elements.feedback.textContent = `Incorrect! This was ${this.currentAnswer}.`;
            this.elements.feedback.className = 'feedback incorrect';
        }

        this.elements.score.textContent = this.score;
        this.currentImageIndex++;

        setTimeout(() => {
            this.showNextImage();
        }, 2000);
    }

    makeComparisonGuess(side) {
        const clickedImageType = side === 'left' ? this.leftImageType : this.rightImageType;
        const correct = clickedImageType === 'fake';

        if (correct) {
            this.score++;
            this.elements.feedback.textContent = 'Correct! You found the fake image.';
            this.elements.feedback.className = 'feedback correct';
        } else {
            this.elements.feedback.textContent = 'Incorrect! That was the real image.';
            this.elements.feedback.className = 'feedback incorrect';
        }

        this.elements.score.textContent = this.score;
        this.currentImageIndex++;

        setTimeout(() => {
            this.showNextImage();
        }, 2000);
    }

    async endGame() {
        this.gameComplete = true;

        // Clear background
        this.elements.background.classList.remove('loaded');
        this.elements.backgroundLeft.classList.remove('loaded');
        this.elements.backgroundRight.classList.remove('loaded');

        // No longer need to submit score to server - it's now a static game
        console.log(`Game completed! Final score: ${this.score}/${this.totalImages} (${Math.round(this.score/this.totalImages*100)}%)`);

        const percentage = Math.round((this.score / this.totalImages) * 100);

        this.elements.gameArea.innerHTML = `
            <div class="game-complete">
                <h2>Game Complete!</h2>
                <p>Final Score: ${this.score}/${this.totalImages} (${percentage}%)</p>
                <p>Refresh the page to play again</p>
            </div>
        `;

        this.elements.buttons.style.display = 'none';
        this.elements.instructions.style.display = 'none';
    }
}

document.addEventListener('DOMContentLoaded', () => {
    new RealOrFakeGame();
});