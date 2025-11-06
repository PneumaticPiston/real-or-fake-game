// Check URL parameters for game mode
const urlParams = new URLSearchParams(window.location.search);
const GAME_MODE = urlParams.get('mode') === 'compare' ? 'compare' : 'single';
const NUM_IMAGES_PER_GAME = urlParams.get('num') ? parseInt(urlParams.get('num')) : -1;

// URL examples:
// index.html (default single mode)
// index.html?mode=compare (compare mode)

class RealOrFakeGame {
    constructor() {
        this.mode = GAME_MODE;
        this.score = 0;
        this.totalImages = NUM_IMAGES_PER_GAME;
        this.currentImageIndex = 0;
        this.allImages = [];
        this.shuffledImages = [];
        this.currentAnswer = null;
        this.gameComplete = false;
        this.answerHistory = [];  // Track user answers and correct answers
        this.isNavigating = false;  // Track if user is navigating vs playing

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
            instructions: document.getElementById('instructions'),
            prevButton: document.getElementById('prevButton'),
            nextButton: document.getElementById('nextButton'),
            navigationMessage: document.getElementById('navigationMessage')
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
                this.totalImages = (this.totalImages === -1) ? this.shuffledImages.length : this.totalImages;
            } else if (this.mode === 'compare') {
                // In compare mode, total is limited by the smaller set
                this.totalImages = (this.totalImages === -1) ? Math.min(data.real.length, data.fake.length) : this.totalImages;
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
        this.elements.prevButton.addEventListener('click', () => this.navigateToPrevious());
        this.elements.nextButton.addEventListener('click', () => this.navigateToNext());
    }

    startGame() {
        if (this.totalImages === 0) return;

        this.elements.loading.style.display = 'none';
        this.elements.prevButton.style.display = 'block';
        this.elements.nextButton.style.display = 'block';

        if (this.mode === 'single') {
            this.elements.buttons.style.display = 'flex';
            this.elements.instructions.style.display = 'none';
        } else if (this.mode === 'compare') {
            this.elements.buttons.style.display = 'none';
            this.elements.instructions.style.display = 'block';
        }
        this.showNextImage();
    }

    async showNextImage() {
        if (this.mode === 'single' && this.currentImageIndex >= this.shuffledImages.length) {
            this.endGame();
            return;
        } else if (this.mode === 'compare' && this.currentImageIndex >= this.totalImages) {
            this.endGame();
            return;
        }

        this.updateNavigationButtons();
        this.updateNavigationMessage();
        
        if (!this.isNavigating) {
            this.disableButtons(true);
            this.elements.feedback.textContent = '';
            this.elements.feedback.className = 'feedback';
        }

        if (this.mode === 'single') {
            await this.showSingleImage();
        } else if (this.mode === 'compare') {
            await this.showcompareImages();
        }

        if (!this.isNavigating) {
            this.disableButtons(false);
        }
        
        this.updateButtonStates();
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

    async showcompareImages() {
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

        // Add click event listeners for compare mode
        leftContainer.addEventListener('click', () => this.makecompareGuess('left'));
        rightContainer.addEventListener('click', () => this.makecompareGuess('right'));

        this.elements.gameArea.innerHTML = '';
        this.elements.gameArea.appendChild(leftContainer);
        this.elements.gameArea.appendChild(rightContainer);

        await this.updatecompareBackground(leftImg.src, rightImg.src);

        this.currentAnswer = 'compare';
        this.leftImageType = images[shuffledPositions[0]].type;
        this.rightImageType = images[shuffledPositions[1]].type;
        this.currentLeftImage = images[shuffledPositions[0]];
        this.currentRightImage = images[shuffledPositions[1]];
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

    async updatecompareBackground(leftSrc, rightSrc) {
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
        if (this.isNavigating) return;  // Don't allow guesses while navigating
        
        let correct = false;

        if (this.mode === 'single') {
            correct = guess === this.currentAnswer;
        }

        // Store answer in history
        this.answerHistory[this.currentImageIndex] = {
            userGuess: guess,
            correctAnswer: this.currentAnswer,
            isCorrect: correct,
            imageData: this.mode === 'single' ? this.shuffledImages[this.currentImageIndex] : null
        };

        if (correct) {
            this.score++;
            this.elements.feedback.textContent = 'Correct!';
            this.elements.feedback.className = 'feedback correct';
        } else {
            this.elements.feedback.textContent = `Incorrect! This was ${this.currentAnswer}.`;
            this.elements.feedback.className = 'feedback incorrect';
        }

        // Add visual feedback to image
        this.addImageFeedback(correct);

        this.elements.score.textContent = this.score;
        this.currentImageIndex++;

        setTimeout(() => {
            this.showNextImage();
        }, 1500);  // Increased delay to see animation
    }

    makecompareGuess(side) {
        if (this.isNavigating) return;  // Don't allow guesses while navigating
        
        const clickedImageType = side === 'left' ? this.leftImageType : this.rightImageType;
        const correct = clickedImageType === 'fake';

        // Store answer in history
        this.answerHistory[this.currentImageIndex] = {
            userGuess: side,
            correctAnswer: this.leftImageType === 'fake' ? 'left' : 'right',
            isCorrect: correct,
            imageData: { 
                leftType: this.leftImageType, 
                rightType: this.rightImageType,
                leftImage: this.currentLeftImage,
                rightImage: this.currentRightImage
            }
        };

        if (correct) {
            this.score++;
            this.elements.feedback.textContent = 'Correct! You found the fake image.';
            this.elements.feedback.className = 'feedback correct';
        } else {
            this.elements.feedback.textContent = 'Incorrect! That was the real image.';
            this.elements.feedback.className = 'feedback incorrect';
        }

        // Add visual feedback to images
        this.addcompareImageFeedback(side, correct);

        this.elements.score.textContent = this.score;
        this.currentImageIndex++;

        setTimeout(() => {
            this.showNextImage();
        }, 2000);
    }

    navigateToPrevious() {
        if (this.currentImageIndex > 0) {
            this.currentImageIndex--;
            this.isNavigating = true;
            this.showNextImage();
        }
    }

    navigateToNext() {
        if (this.currentImageIndex < this.answerHistory.length - 1) {
            this.currentImageIndex++;
            this.isNavigating = true;
            this.showNextImage();
        } else if (this.currentImageIndex === this.answerHistory.length - 1 && !this.gameComplete) {
            // Go to next unseen image
            this.currentImageIndex++;
            this.isNavigating = false;
            this.showNextImage();
        }
    }

    updateNavigationButtons() {
        // Previous button - disabled if at first image
        this.elements.prevButton.disabled = this.currentImageIndex === 0;
        
        // Next button - disabled if at the last answered image and game not complete
        const canGoNext = this.currentImageIndex < this.answerHistory.length - 1 || 
                         (this.currentImageIndex < this.totalImages - 1 && !this.gameComplete);
        this.elements.nextButton.disabled = !canGoNext;
    }

    updateNavigationMessage() {
        const history = this.answerHistory[this.currentImageIndex];
        
        if (this.isNavigating && history) {
            const correctAnswer = history.correctAnswer;
            const messageText = `This image was ${correctAnswer.toUpperCase()}`;
            
            this.elements.navigationMessage.textContent = messageText;
            this.elements.navigationMessage.className = `navigation-message ${correctAnswer}`;
            this.elements.navigationMessage.style.display = 'block';
        } else {
            this.elements.navigationMessage.style.display = 'none';
        }
    }

    updateButtonStates() {
        if (this.isNavigating && this.mode === 'single') {
            const history = this.answerHistory[this.currentImageIndex];
            if (history) {
                // Reset button states
                this.elements.btnReal.classList.remove('selected', 'unselected');
                this.elements.btnFake.classList.remove('selected', 'unselected');
                
                // Highlight the user's choice and gray out the other
                if (history.userGuess === 'real') {
                    this.elements.btnReal.classList.add('selected');
                    this.elements.btnFake.classList.add('unselected');
                } else {
                    this.elements.btnFake.classList.add('selected');
                    this.elements.btnReal.classList.add('unselected');
                }
                
                // Disable buttons during navigation
                this.elements.btnReal.disabled = true;
                this.elements.btnFake.disabled = true;
            }
        } else if (!this.isNavigating && this.mode === 'single') {
            // Reset to normal state when not navigating
            this.elements.btnReal.classList.remove('selected', 'unselected');
            this.elements.btnFake.classList.remove('selected', 'unselected');
            this.elements.btnReal.disabled = false;
            this.elements.btnFake.disabled = false;
        }
    }

    addImageFeedback(correct) {
        const images = document.querySelectorAll('.game-image');
        images.forEach(img => {
            img.classList.remove('correct', 'incorrect');
            img.classList.add(correct ? 'correct' : 'incorrect');
            
            // Remove animation class after animation completes
            setTimeout(() => {
                img.classList.remove('correct', 'incorrect');
            }, 600);
        });
    }

    addcompareImageFeedback(selectedSide, correct) {
        const images = document.querySelectorAll('.game-image');
        images.forEach((img, index) => {
            const isSelected = (selectedSide === 'left' && index === 0) || 
                              (selectedSide === 'right' && index === 1);
            
            if (isSelected) {
                img.classList.add(correct ? 'correct' : 'incorrect');
                
                setTimeout(() => {
                    img.classList.remove('correct', 'incorrect');
                }, 600);
            }
        });
    }

    async endGame() {
        this.gameComplete = true;

        // Clear background
        this.elements.background.classList.remove('loaded');
        this.elements.backgroundLeft.classList.remove('loaded');
        this.elements.backgroundRight.classList.remove('loaded');

        // Hide navigation buttons and message
        this.elements.prevButton.style.display = 'none';
        this.elements.nextButton.style.display = 'none';
        this.elements.navigationMessage.style.display = 'none';

        // No longer need to submit score to server - it's now a static game
        console.log(`Game completed! Final score: ${this.score}/${this.totalImages} (${Math.round(this.score/this.totalImages*100)}%)`);

        const percentage = Math.round((this.score / this.totalImages) * 100);

        // Generate results summary
        const resultsList = this.generateResultsSummary();

        this.elements.gameArea.innerHTML = `
            <div class="game-complete">
                <h2>Game Complete!</h2>
                <p>Final Score: ${this.score}/${this.totalImages} (${percentage}%)</p>
                <div class="results-summary">
                    <h3>Your Answers:</h3>
                    <div class="results-list">
                        ${resultsList}
                    </div>
                </div>
                <p>Refresh the page to play again</p>
            </div>
        `;

        this.elements.buttons.style.display = 'none';
        this.elements.instructions.style.display = 'none';
    }

    generateResultsSummary() {
        if (!this.answerHistory || this.answerHistory.length === 0) {
            return '<p>No answers recorded.</p>';
        }

        return this.answerHistory.map((answer, index) => {
            const isCorrect = answer.isCorrect;
            const correctClass = isCorrect ? 'correct-result' : 'incorrect-result';
            const correctIcon = isCorrect ? '✓' : '✗';
            
            let resultText = '';
            if (this.mode === 'single') {
                const imageData = answer.imageData;
                const imageSrc = `images/${imageData.type}/${imageData.file}`;
                
                resultText = `
                    <div class="result-item ${correctClass}">
                        <div class="result-image">
                            <img src="${imageSrc}" alt="Question ${index + 1}" />
                        </div>
                        <div class="result-details">
                            <div class="result-header">
                                <span class="result-number">${index + 1}.</span>
                                <span class="result-icon">${correctIcon}</span>
                            </div>
                            <div class="result-text">
                                Image was <strong>${answer.correctAnswer.toUpperCase()}</strong>, 
                                you chose <strong>${answer.userGuess.toUpperCase()}</strong>
                            </div>
                        </div>
                    </div>
                `;
            } else {
                // compare mode - show both images
                const imageData = answer.imageData;
                const leftImageSrc = `images/${imageData.leftImage.type}/${imageData.leftImage.file}`;
                const rightImageSrc = `images/${imageData.rightImage.type}/${imageData.rightImage.file}`;
                
                // Determine which image was fake based on the stored data
                const fakeImageSrc = imageData.leftType === 'fake' ? leftImageSrc : rightImageSrc;
                const realImageSrc = imageData.leftType === 'real' ? leftImageSrc : rightImageSrc;
                
                resultText = `
                    <div class="result-item ${correctClass}">
                        <div class="result-images">
                            <div class="compare-image">
                                <img src="${realImageSrc}" alt="Real image" />
                                <span class="image-label real-label">REAL</span>
                            </div>
                            <div class="compare-image">
                                <img src="${fakeImageSrc}" alt="Fake image" />
                                <span class="image-label fake-label">FAKE</span>
                            </div>
                        </div>
                        <div class="result-details">
                            <div class="result-header">
                                <span class="result-number">${index + 1}.</span>
                                <span class="result-icon">${correctIcon}</span>
                            </div>
                            <div class="result-text">
                                Fake was on the <strong>${answer.correctAnswer.toUpperCase()}</strong>, 
                                you chose <strong>${answer.userGuess.toUpperCase()}</strong>
                            </div>
                        </div>
                    </div>
                `;
            }
            
            return resultText;
        }).join('');
    }
}

document.addEventListener('DOMContentLoaded', () => {
    new RealOrFakeGame();
});
