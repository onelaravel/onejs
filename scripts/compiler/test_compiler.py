"""
Test cases cho Blade Compiler
"""

from main_compiler import BladeCompiler

def test_basic_compilation():
    """Test basic blade compilation"""
    compiler = BladeCompiler()
    
    blade_code = """@vars($users = [], $title = 'Test')
<h1>{{ $title }}</h1>
<ul>
    @foreach($users as $user)
        <li>{{ $user->name }}</li>
    @endforeach
</ul>"""
    
    result = compiler.compile_blade_to_js(blade_code, 'test')
    print("=== BASIC COMPILATION TEST ===")
    print(result)
    print()

def test_extends_compilation():
    """Test extends compilation"""
    compiler = BladeCompiler()
    
    blade_code = """@extends('layouts.app')

@section('title', 'Home Page')

@section('content')
    <h1>Welcome!</h1>
    <p>{{ $message }}</p>
@endsection"""
    
    result = compiler.compile_blade_to_js(blade_code, 'home')
    print("=== EXTENDS COMPILATION TEST ===")
    print(result)
    print()

def test_async_compilation():
    """Test async directives compilation"""
    compiler = BladeCompiler()
    
    blade_code = """@vars($users)
@fetch('/api/users')
@await($users)

<div>
    <h1>Users</h1>
    @foreach($users as $user)
        <div>{{ $user->name }}</div>
    @endforeach
</div>"""
    
    result = compiler.compile_blade_to_js(blade_code, 'users')
    print("=== ASYNC COMPILATION TEST ===")
    print(result)
    print()

def run_all_tests():
    """Run all test cases"""
    test_basic_compilation()
    test_extends_compilation()
    test_async_compilation()

if __name__ == "__main__":
    run_all_tests()