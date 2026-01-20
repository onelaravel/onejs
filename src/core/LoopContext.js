export class LoopContext {
    constructor(parent = null) {
        this.odd = true;
        this.even = false;
        this.first = false;
        this.last = false;
        this.iteration = 0;
        this.index = 0;
        this.remaining = null;
        this.count = null;
        this.depth = 0;
        this.parent = parent;

        this.type = 'increment';
    }

    setType(type) {
        if(type === 'increment' || type === 'decrement') {
            this.type = type;
        }
    }

    reset() {
        this.iteration = 0;
        this.index = 0;
        this.remaining = null;
        this.count = null;
        this.first = false;
        this.last = false;
        this.odd = true;
        this.even = false;
    }

    increment() {
        this.iteration++;
        this.index++;
        if (this.remaining !== null) {
            this.remaining--;
        }
        this.first = this.iteration === 0;
        this.last = this.iteration === this.count - 1;
    }

    decrement() {
        this.iteration--;
        this.index--;
        if (this.remaining !== null) {
            this.remaining++;
        }
        this.last = this.iteration === this.count - 1;
        this.odd = !this.odd;
        this.even = !this.even;
    }
    next() {
        if (this.type === 'increment') {
            this.increment();
        } else {
            this.decrement();
        }
    }

    setCount(count) {
        this.count = count;
        this.remaining = count;
        this.last = count === 1;
        this.odd = false;
        this.even = true;
    }

    /**
     * Set the current times of the loop (iteration)
     * @param {number} iteration iteration của vòng lặp hiện tại
     */
    setCurrentTimes(iteration) {
        this.iteration = iteration;
        if (this.remaining !== null) {
            this.remaining--;
        }
        this.index = this.iteration;
        this.first = this.iteration === 0;
        this.last = this.iteration === this.count - 1;
        this.odd = !this.odd;
        this.even = !this.even;
    }

    setParent(parent) {
        this.parent = parent;
    }

    getParent() {
        return this.parent;
    }

    newChild() {
        return new LoopContext(this);
    }
}