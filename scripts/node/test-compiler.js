/**
 * Test script for Node.js Blade Compiler
 */

const BladeCompiler = require('./compiler/main-compiler');

// Test Blade template
const testBladeCode = `
@extends('layouts.base')

@section('document.body')
<div class="container">
    <h1>Welcome {{ $user->name }}</h1>
    
    @if($posts && count($posts) > 0)
        <div class="posts">
            @foreach($posts as $post)
                <div class="post" @click(handlePostClick($post->id))>
                    <h3>{{ $post->title }}</h3>
                    <p>{{ $post->content }}</p>
                </div>
            @endforeach
        </div>
    @else
        <p>No posts available.</p>
    @endif
    
    <button @click(handleButtonClick) class="btn btn-primary">
        Click Me
    </button>
</div>
@endsection
`;

// Test the compiler
console.log('Testing Node.js Blade Compiler...\n');

try {
    const compiler = new BladeCompiler();
    const jsCode = compiler.compileBladeToJs(testBladeCode, 'web.test');
    
    console.log('✅ Compilation successful!');
    console.log('\n=== Generated JavaScript ===');
    console.log(jsCode);
    
} catch (error) {
    console.error('❌ Compilation failed:', error.message);
    console.error(error.stack);
}

console.log('\n=== Test completed ===');

