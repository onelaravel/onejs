<?php

/**
 * Script Migration Namespace
 * 
 * Script này giúp tự động refactor namespace từ cấu trúc cũ sang cấu trúc mới:
 * - Core\ → One\Core\
 * - Modules\ → One\Modules\
 * - Contexts\ → One\Contexts\
 * - Shared\ → One\Shared\
 * - Support\ → One\Support\
 * - Infrastructure\ → One\Infrastructure\
 * 
 * Cũng hỗ trợ migration từ OneLaravel\ sang One\
 */

class NamespaceMigrator
{
    private array $mappings = [
        // Migration từ namespace cũ (không có prefix) sang One\
        'Core\\' => 'One\\Core\\',
        'Modules\\' => 'One\\Modules\\',
        'Contexts\\' => 'One\\Contexts\\',
        'Shared\\' => 'One\\Shared\\',
        'Support\\' => 'One\\Support\\',
        'Infrastructure\\' => 'One\\Infrastructure\\',
        // Migration từ OneLaravel\ sang One\ (nếu có)
        'OneLaravel\\Core\\' => 'One\\Core\\',
        'OneLaravel\\Modules\\' => 'One\\Modules\\',
        'OneLaravel\\Contexts\\' => 'One\\Contexts\\',
        'OneLaravel\\Shared\\' => 'One\\Shared\\',
        'OneLaravel\\Support\\' => 'One\\Support\\',
        'OneLaravel\\Infrastructure\\' => 'One\\Infrastructure\\',
    ];

    private array $directories = [
        'src',
        'app',
        'routes',
        'tests',
        'config',
    ];

    private int $filesProcessed = 0;
    private int $filesChanged = 0;

    public function migrate(): void
    {
        echo "🚀 Bắt đầu migration namespace...\n\n";

        foreach ($this->directories as $dir) {
            if (!is_dir($dir)) {
                continue;
            }

            $this->processDirectory($dir);
        }

        echo "\n✅ Hoàn thành!\n";
        echo "📊 Thống kê:\n";
        echo "   - Tổng số file đã xử lý: {$this->filesProcessed}\n";
        echo "   - Số file đã thay đổi: {$this->filesChanged}\n";
    }

    private function processDirectory(string $dir): void
    {
        $iterator = new RecursiveIteratorIterator(
            new RecursiveDirectoryIterator($dir, RecursiveDirectoryIterator::SKIP_DOTS),
            RecursiveIteratorIterator::SELF_FIRST
        );

        foreach ($iterator as $file) {
            if (!$file->isFile() || $file->getExtension() !== 'php') {
                continue;
            }

            $this->processFile($file->getPathname());
        }
    }

    private function processFile(string $filePath): void
    {
        $this->filesProcessed++;

        $content = file_get_contents($filePath);
        $originalContent = $content;
        $changed = false;

        // Thay thế namespace declarations
        foreach ($this->mappings as $old => $new) {
            // Pattern: namespace OldNamespace\...
            $pattern = '/^namespace\s+' . preg_quote($old, '/') . '/m';
            if (preg_match($pattern, $content)) {
                $content = preg_replace($pattern, 'namespace ' . $new, $content);
                $changed = true;
            }

            // Thay thế use statements
            $pattern = '/^use\s+' . preg_quote($old, '/') . '/m';
            if (preg_match($pattern, $content)) {
                $content = preg_replace($pattern, 'use ' . $new, $content);
                $changed = true;
            }
        }

        // Thay thế trong string references (ví dụ: class_exists, new, etc.)
        foreach ($this->mappings as $old => $new) {
            // Trong single quotes
            $content = preg_replace(
                "/(['])" . preg_quote($old, '/') . '/',
                '$1' . $new,
                $content
            );
            
            // Trong double quotes
            $content = preg_replace(
                '/(["])' . preg_quote($old, '/') . '/',
                '$1' . $new,
                $content
            );
        }

        // Thay thế trong string concatenation và các trường hợp khác
        foreach ($this->mappings as $old => $new) {
            if (strpos($content, $old) !== false) {
                $content = str_replace($old, $new, $content);
                $changed = true;
            }
        }

        if ($changed && $content !== $originalContent) {
            file_put_contents($filePath, $content);
            $this->filesChanged++;
            echo "✓ Đã cập nhật: {$filePath}\n";
        }
    }
}

// Chạy migration
if (php_sapi_name() === 'cli') {
    $migrator = new NamespaceMigrator();
    $migrator->migrate();
} else {
    echo "Script này chỉ chạy được từ command line.\n";
}

