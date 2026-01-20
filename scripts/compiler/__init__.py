"""
Blade Template Compiler Package
"""

import sys
import os

# Add current directory to Python path for relative imports
current_dir = os.path.dirname(os.path.abspath(__file__))
if current_dir not in sys.path:
    sys.path.insert(0, current_dir)

from main_compiler import BladeCompiler

__version__ = "1.0.0"
__author__ = "Blade Compiler Team"

__all__ = ['BladeCompiler']