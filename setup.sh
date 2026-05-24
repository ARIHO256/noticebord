#!/bin/bash
# =============================================================================
# Bugema University NoticeBoard - Complete Environment Setup
# =============================================================================
# This script sets up .env files for both backend and mobile applications.
#
# Usage:
#   ./setup.sh              # Interactive setup
#   ./setup.sh --auto       # Auto-generate with defaults
#   ./setup.sh --production # Production configuration
# =============================================================================

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

AUTO=false
PRODUCTION=false

# Parse arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        --auto)
            AUTO=true
            shift
            ;;
        --production)
            PRODUCTION=true
            shift
            ;;
        --help|-h)
            echo "Usage: ./setup.sh [OPTIONS]"
            echo ""
            echo "Options:"
            echo "  --auto         Auto-generate .env files without prompts"
            echo "  --production   Generate production configuration"
            echo "  --help, -h     Show this help message"
            echo ""
            echo "Examples:"
            echo "  ./setup.sh                    # Interactive development setup"
            echo "  ./setup.sh --auto             # Quick development setup"
            echo "  ./setup.sh --auto --production # Quick production setup"
            exit 0
            ;;
        *)
            echo "Unknown option: $1"
            echo "Run './setup.sh --help' for usage information."
            exit 1
            ;;
    esac
done

print_header() {
    echo ""
    echo -e "${BLUE}============================================================${NC}"
    echo -e "${BLUE}  Bugema University NoticeBoard - Environment Setup${NC}"
    echo -e "${BLUE}============================================================${NC}"
    echo ""
}

print_success() {
    echo -e "${GREEN}✓${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}⚠${NC} $1"
}

print_error() {
    echo -e "${RED}✗${NC} $1"
}

setup_backend() {
    echo -e "${BLUE}Setting up Backend...${NC}"
    echo ""
    
    cd "$SCRIPT_DIR/backend"
    
    # Check if Python is available
    if ! command -v python3 &> /dev/null; then
        print_error "python3 is not installed. Please install Python 3.10+."
        return 1
    fi
    
    # Create virtual environment if it doesn't exist
    if [ ! -d ".venv" ]; then
        echo "Creating Python virtual environment..."
        python3 -m venv .venv
        print_success "Virtual environment created"
    fi
    
    # Activate virtual environment
    source .venv/bin/activate
    
    # Install dependencies
    echo "Installing Python dependencies..."
    pip install -q python-dotenv 2>/dev/null || true
    
    # Generate .env file
    if [ "$PRODUCTION" = true ]; then
        python setup_env.py --auto --production
    elif [ "$AUTO" = true ]; then
        python setup_env.py --auto
    else
        python setup_env.py
    fi
    
    print_success "Backend .env configured"
    echo ""
}

setup_mobile() {
    echo -e "${BLUE}Setting up Mobile App...${NC}"
    echo ""
    
    cd "$SCRIPT_DIR/mobile"
    
    # Check if Node.js is available
    if ! command -v node &> /dev/null; then
        print_warning "Node.js is not installed. Skipping mobile setup."
        print_warning "Install Node.js from https://nodejs.org/"
        return 1
    fi
    
    # Generate .env file
    if [ "$AUTO" = true ] || [ "$PRODUCTION" = true ]; then
        node setup_env.js --auto
    else
        node setup_env.js
    fi
    
    print_success "Mobile .env configured"
    echo ""
}

print_next_steps() {
    echo ""
    echo -e "${GREEN}============================================================${NC}"
    echo -e "${GREEN}  Setup Complete!${NC}"
    echo -e "${GREEN}============================================================${NC}"
    echo ""
    echo "Next steps:"
    echo ""
    echo "1. BACKEND:"
    echo "   cd backend"
    echo "   source .venv/bin/activate"
    echo "   pip install -r requirements.txt"
    echo "   python manage.py migrate"
    echo "   python manage.py runserver"
    echo ""
    echo "2. MOBILE:"
    echo "   cd mobile"
    echo "   npm install"
    echo "   npx expo start"
    echo ""
    echo "3. DOCKER (alternative):"
    echo "   docker-compose up --build"
    echo ""
    echo -e "${YELLOW}IMPORTANT:${NC}"
    echo "  - Review and update the generated .env files"
    echo "  - NEVER commit .env files to version control"
    echo "  - For production, update passwords and secret keys"
    echo ""
    echo -e "${GREEN}============================================================${NC}"
    echo ""
}

# Main execution
print_header

setup_backend
setup_mobile

print_next_steps
