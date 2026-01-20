/**
 * Class quản lý việc parse và tìm kiếm các cặp comment tags
 * Hỗ trợ tìm kiếm theo pattern với wildcard (*)
 * 
 * @example
 * const parser = new TemplateDetectorService(document.body);
 * const pairs = parser.find('one-template:*');
 * parser.display(pairs);
 */
export class TemplateDetectorService {
    /**
     * Khởi tạo parser với element gốc
     * @param {Element} rootElement - Element gốc để tìm kiếm (mặc định: document.body)
     */
    constructor(rootElement = document.body) {
        this.rootElement = rootElement || document.body;
        this.cachedComments = null;
    }

    /**
     * Đặt element gốc mới
     * @param {Element} element - Element gốc mới
     */
    setRootElement(element) {
        this.rootElement = element;
        this.cachedComments = null;
        return this;
    }

    /**
     * Lấy tất cả comment nodes từ rootElement
     * @param {boolean} useCache - Sử dụng cache hay không
     * @returns {Array<Comment>}
     */
    getAllComments(useCache = true) {
        if (useCache && this.cachedComments) {
            return this.cachedComments;
        }

        const comments = [];
        const walker = document.createTreeWalker(
            this.rootElement,
            NodeFilter.SHOW_COMMENT,
            null,
            false
        );

        let node;
        while (node = walker.nextNode()) {
            comments.push(node);
        }

        if (useCache) {
            this.cachedComments = comments;
        }

        return comments;
    }

    /**
     * Parse một comment node để lấy thông tin
     * @param {Comment} commentNode - Comment node cần parse
     * @returns {Object|null} - Thông tin tag hoặc null nếu không phải tag hợp lệ
     */
    parseComment(commentNode) {
        const text = commentNode.nodeValue.trim();

        // Pattern tổng quát: [prefix:name] hoặc [prefix]
        // Kiểm tra tag mở: <!-- [prefix:name attribute="..."] -->
        const openMatch = text.match(/^\[([^\/\]]+?)(?:\s+(.+))?\]$/);
        if (openMatch) {
            const fullName = openMatch[1];
            const attributes = {};

            if (openMatch[2]) {
                // Parse các attributes như subscribe="userState,items"
                const attrMatch = openMatch[2].match(/(\w+)="([^"]+)"/g);
                if (attrMatch) {
                    attrMatch.forEach(attr => {
                        const [key, value] = attr.split('=');
                        attributes[key] = value.replace(/"/g, '');
                    });
                }
            }

            return {
                type: 'open',
                fullName: fullName,
                attributes: attributes,
                node: commentNode
            };
        }

        // Kiểm tra tag đóng: <!-- [/prefix:name] -->
        const closeMatch = text.match(/^\[\/([^\/\]]+?)\]$/);
        if (closeMatch) {
            return {
                type: 'close',
                fullName: closeMatch[1],
                node: commentNode
            };
        }

        return null;
    }

    /**
     * Lấy tất cả các siblings giữa hai node (cùng parent)
     * @param {Node} startNode - Node bắt đầu
     * @param {Node} endNode - Node kết thúc
     * @returns {Array<Node>|null} - Mảng nodes hoặc null nếu không cùng parent
     */
    getNodesBetween(startNode, endNode) {
        // Kiểm tra xem có cùng parent không
        if (startNode.parentNode !== endNode.parentNode) {
            return null;
        }

        const nodes = [];
        let current = startNode.nextSibling;

        while (current && current !== endNode) {
            nodes.push(current);
            current = current.nextSibling;
        }

        return nodes;
    }

    /**
     * Chuyển đổi pattern thành regex
     * @param {string} pattern - Pattern với wildcard (*)
     * @returns {RegExp}
     * 
     * @example
     * patternToRegex('*:*')              // Match tất cả
     * patternToRegex('one-*')            // Match "one-template", "one-component"
     * patternToRegex('one-template:*')   // Match "one-template:profile", etc.
     */
    patternToRegex(pattern) {
        if (!pattern || pattern === '*' || pattern === '*:*') {
            return /.*/;
        }

        // Escape các ký tự đặc biệt trong regex (trừ *)
        let regexStr = pattern
            .replace(/[.+?^${}()|[\]\\]/g, '\\$&')  // Escape regex special chars
            .replace(/\*/g, '.*');                    // Convert * thành .*

        // Thêm ^ và $ để match chính xác toàn bộ string
        regexStr = '^' + regexStr + '$';

        return new RegExp(regexStr);
    }

    /**
     * Kiểm tra xem một tên có khớp với pattern không
     * @param {string} fullName - Tên đầy đủ của tag
     * @param {string} pattern - Pattern để so khớp
     * @returns {boolean}
     */
    matchPattern(fullName, pattern) {
        const regex = this.patternToRegex(pattern);
        return regex.test(fullName);
    }

    /**
     * Tìm tất cả các cặp tags theo pattern
     * @param {string} pattern - Pattern để lọc (mặc định: '*:*')
     * @param {Object} options - Tùy chọn bổ sung
     * @param {boolean} options.useCache - Sử dụng cache comments
     * @returns {Array<Object>} - Mảng các cặp tags tìm được
     * 
     * @example
     * parser.find('*:*')                   // Tìm tất cả
     * parser.find('one-template:*')        // Chỉ tìm one-template
     * parser.find('one-template:profile')  // Tìm chính xác profile
     */
    find(pattern = '*:*', options = {}, total = null) {
        const { useCache = true } = options;
        const isTotal = total && typeof total === 'number' && total > 0;
        const isLast = total && total === -1;
        const isFirst = total && total === 1;
        const comments = this.getAllComments(useCache);
        const parsed = comments.map(c => this.parseComment(c)).filter(p => p !== null);
        // console.error({ parsed });
        const pairs = [];
        const stack = [];

        for (let i = 0; i < parsed.length; i++) {
            const current = parsed[i];

            // Kiểm tra xem có khớp với pattern không
            if (!this.matchPattern(current.fullName, pattern)) {
                continue;
            }

            if (current.type === 'open') {
                // Đẩy tag mở vào stack
                stack.push({
                    ...current,
                    index: i
                });
            } else if (current.type === 'close') {
                // Tìm tag mở tương ứng từ stack
                let foundIndex = -1;
                for (let j = stack.length - 1; j >= 0; j--) {
                    if (stack[j].fullName === current.fullName) {
                        foundIndex = j;
                        break;
                    }
                }

                if (foundIndex !== -1) {
                    const openTag = stack[foundIndex];

                    // Lấy các nodes nằm giữa
                    const nodesBetween = this.getNodesBetween(openTag.node, current.node);

                    // Chỉ thêm vào nếu cùng parent
                    if (nodesBetween !== null) {
                        pairs.push({
                            fullName: current.fullName,
                            openTag: openTag.node,
                            closeTag: current.node,
                            attributes: openTag.attributes,
                            nodes: nodesBetween,
                            parent: openTag.node.parentNode
                        });
                    }

                    // Xóa khỏi stack
                    stack.splice(foundIndex, 1);
                }
            }
        }

        return pairs;
    }

    /**
     * Tìm một cặp tag duy nhất theo pattern
     * @param {string} pattern - Pattern để tìm
     * @returns {Object|null} - Cặp tag tìm được hoặc null
     */
    findOne(pattern) {
        const pairs = this.find(pattern);
        return pairs.length > 0 ? pairs[0] : null;
    }

    /**
     * Lọc các cặp tags theo điều kiện tùy chỉnh
     * @param {Function} filterFn - Hàm filter (pair) => boolean
     * @param {string} pattern - Pattern ban đầu
     * @returns {Array<Object>}
     */
    filter(filterFn, pattern = '*:*') {
        const pairs = this.find(pattern);
        return pairs.filter(filterFn);
    }

    /**
     * Đếm số lượng cặp tags theo pattern
     * @param {string} pattern - Pattern để đếm
     * @returns {number}
     */
    count(pattern = '*:*') {
        return this.find(pattern).length;
    }

    /**
     * Lấy danh sách tất cả các tên tags duy nhất
     * @param {string} pattern - Pattern để lọc
     * @returns {Array<string>}
     */
    getUniqueNames(pattern = '*:*') {
        const pairs = this.find(pattern);
        return [...new Set(pairs.map(p => p.fullName))];
    }

    /**
     * Hiển thị kết quả tìm kiếm trong console
     * @param {Array<Object>|string} pairsOrPattern - Mảng pairs hoặc pattern string
     * @param {Object} options - Tùy chọn hiển thị
     */
    display(pairsOrPattern, options = {}) {
        const {
            showAttributes = true,
            showParent = true,
            showNodes = true,
            maxNodePreview = 3
        } = options;

        let pairs, patternInfo = '';

        // Nếu truyền vào là string, tìm kiếm trước
        if (typeof pairsOrPattern === 'string') {
            patternInfo = ` với pattern "${pairsOrPattern}"`;
            pairs = this.find(pairsOrPattern);
        } else {
            pairs = pairsOrPattern;
        }

        console.log(`\n${'='.repeat(80)}`);
        console.log(`Tìm thấy ${pairs.length} cặp tags${patternInfo}`);
        console.log(`${'='.repeat(80)}\n`);

        if (pairs.length === 0) {
            console.log('❌ Không tìm thấy cặp tags nào!');
            return;
        }

        pairs.forEach((pair, index) => {
            console.log(`\n📦 Cặp ${index + 1}: [${pair.fullName}]`);
            console.log('-'.repeat(60));

            if (showAttributes) {
                console.log('📋 Attributes:',
                    Object.keys(pair.attributes).length > 0
                        ? pair.attributes
                        : '(không có)'
                );
            }

            if (showParent) {
                console.log('🔼 Parent:', pair.parent.tagName.toLowerCase(),
                    pair.parent.className ? `class="${pair.parent.className}"` : ''
                );
            }

            if (showNodes) {
                console.log(`📄 Nội dung (${pair.nodes.length} nodes):`);

                const previewNodes = pair.nodes.slice(0, maxNodePreview);
                previewNodes.forEach(node => {
                    if (node.nodeType === Node.ELEMENT_NODE) {
                        const className = node.className ? ` class="${node.className}"` : '';
                        console.log(`   ├─ <${node.tagName.toLowerCase()}${className}>`);
                    } else if (node.nodeType === Node.TEXT_NODE && node.nodeValue.trim()) {
                        const text = node.nodeValue.trim().substring(0, 50);
                        console.log(`   ├─ Text: "${text}${text.length >= 50 ? '...' : ''}"`);
                    }
                });

                if (pair.nodes.length > maxNodePreview) {
                    console.log(`   └─ ... và ${pair.nodes.length - maxNodePreview} nodes khác`);
                }
            }
        });

        console.log(`\n${'='.repeat(80)}\n`);
    }

    /**
     * Xóa cache để buộc parse lại
     */
    clearCache() {
        this.cachedComments = null;
        return this;
    }
}