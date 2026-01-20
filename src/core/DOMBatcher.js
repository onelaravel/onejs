/**
 * DOMBatcher
 * 
 * Tối ưu hóa các thao tác DOM bằng cách gom nhóm đọc và ghi để ngăn layout thrashing.
 * Sử dụng RequestAnimationFrame để lên lịch các thao tác theo batch.
 * 
 * Lợi ích hiệu suất:
 * - Ngăn chặn forced synchronous layouts (reflows)
 * - Gom nhóm đọc trước ghi trong mỗi frame
 * - Giảm tính toán layout từ O(n²) xuống O(n)
 * - Cải thiện hiệu suất render cho UI động
 * 
 * Mẫu sử dụng:
 * ```javascript
 * // XẤU: Gây layout thrashing
 * element1.style.width = element2.offsetWidth + 'px'; // đọc-ghi
 * element3.style.height = element4.offsetHeight + 'px'; // đọc-ghi
 * 
 * // TỐT: Thao tác theo batch
 * DOMBatcher.read(() => element2.offsetWidth)
 *     .then(width => DOMBatcher.write(() => element1.style.width = width + 'px'));
 * DOMBatcher.read(() => element4.offsetHeight)
 *     .then(height => DOMBatcher.write(() => element3.style.height = height + 'px'));
 * ```
 * 
 * @class DOMBatcher
 * @version 1.0.0
 * @since 2025-01-06
 */
class DOMBatcher {
    constructor() {
        /** @type {Array<{fn: Function, resolve: Function, reject: Function}>} */
        this.readQueue = [];
        
        /** @type {Array<{fn: Function, resolve: Function, reject: Function}>} */
        this.writeQueue = [];
        
        /** @type {number|null} */
        this.rafId = null;
        
        /** @type {boolean} */
        this.isProcessing = false;
    }

    /**
     * Lên lịch thao tác đọc DOM
     * Tất cả thao tác đọc được gom nhóm và thực thi trước ghi trong frame tiếp theo
     * 
     * @param {Function} fn - Hàm đọc từ DOM (trả về giá trị)
     * @returns {Promise<any>} Promise resolve với giá trị đọc được
     * 
     * @example
     * const width = await DOMBatcher.read(() => element.offsetWidth);
     * const rect = await DOMBatcher.read(() => element.getBoundingClientRect());
     */
    read(fn) {
        return new Promise((resolve, reject) => {
            this.readQueue.push({ fn, resolve, reject });
            this.scheduleFlush();
        });
    }

    /**
     * Lên lịch thao tác ghi DOM
     * Tất cả thao tác ghi được gom nhóm và thực thi sau đọc trong frame tiếp theo
     * 
     * @param {Function} fn - Hàm ghi vào DOM
     * @returns {Promise<void>} Promise resolve khi ghi hoàn thành
     * 
     * @example
     * await DOMBatcher.write(() => element.style.width = '100px');
     * await DOMBatcher.write(() => element.classList.add('active'));
     */
    write(fn) {
        return new Promise((resolve, reject) => {
            this.writeQueue.push({ fn, resolve, reject });
            this.scheduleFlush();
        });
    }

    /**
     * Lên lịch flush nếu chưa được lên lịch
     * Sử dụng RAF để gom nhóm thao tác trong frame tiếp theo
     * 
     * @private
     */
    scheduleFlush() {
        if (this.rafId !== null) {
            return; // Đã được lên lịch
        }

        this.rafId = requestAnimationFrame(() => {
            this.flush();
        });
    }

    /**
     * Thực thi tất cả thao tác đã gom nhóm
     * Đọc trước, sau đó ghi để ngăn layout thrashing
     * 
     * @private
     */
    flush() {
        if (this.isProcessing) {
            // Lên lịch lại nếu đang xử lý
            this.rafId = null;
            this.scheduleFlush();
            return;
        }

        this.isProcessing = true;
        this.rafId = null;

        try {
            // Giai đoạn 1: Thực thi tất cả thao tác đọc
            const reads = this.readQueue.splice(0);
            reads.forEach(({ fn, resolve, reject }) => {
                try {
                    const result = fn();
                    resolve(result);
                } catch (error) {
                    console.error('[DOMBatcher] Read error:', error);
                    reject(error);
                }
            });

            // Giai đoạn 2: Thực thi tất cả thao tác ghi
            const writes = this.writeQueue.splice(0);
            writes.forEach(({ fn, resolve, reject }) => {
                try {
                    fn();
                    resolve();
                } catch (error) {
                    console.error('[DOMBatcher] Write error:', error);
                    reject(error);
                }
            });
        } finally {
            this.isProcessing = false;
        }
    }

    /**
     * Xóa tất cả thao tác đang chờ và hủy RAF
     * Dùng để dọn dẹp hoặc khôi phục lỗi
     */
    clear() {
        if (this.rafId !== null) {
            cancelAnimationFrame(this.rafId);
            this.rafId = null;
        }
        
        this.readQueue.length = 0;
        this.writeQueue.length = 0;
        this.isProcessing = false;
    }

    /**
     * Đo nhiều element cùng lúc (đọc theo batch tối ưu)
     * 
     * @param {Array<{element: HTMLElement, properties: string[]}>} measurements
     * @returns {Promise<Array<Object>>} Mảng kết quả đo
     * 
     * @example
     * const results = await DOMBatcher.measure([
     *     { element: el1, properties: ['offsetWidth', 'offsetHeight'] },
     *     { element: el2, properties: ['clientWidth', 'scrollTop'] }
     * ]);
     */
    measure(measurements) {
        return this.read(() => {
            return measurements.map(({ element, properties }) => {
                const result = {};
                properties.forEach(prop => {
                    result[prop] = element[prop];
                });
                return result;
            });
        });
    }

    /**
     * Áp dụng nhiều thay đổi style cùng lúc (ghi theo batch tối ưu)
     * 
     * @param {Array<{element: HTMLElement, styles: Object}>} styleChanges
     * @returns {Promise<void>}
     * 
     * @example
     * await DOMBatcher.applyStyles([
     *     { element: el1, styles: { width: '100px', height: '50px' } },
     *     { element: el2, styles: { display: 'none' } }
     * ]);
     */
    applyStyles(styleChanges) {
        return this.write(() => {
            styleChanges.forEach(({ element, styles }) => {
                Object.entries(styles).forEach(([prop, value]) => {
                    element.style[prop] = value;
                });
            });
        });
    }
}

// Export instance singleton
const batcher = new DOMBatcher();
export default batcher;
