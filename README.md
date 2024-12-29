# 🔒 PARANOID - Telegram OSINT Tool

[English](#english) | [Русский](#русский)

---

# English

## 📋 Description
PARANOID is a powerful OSINT tool for Telegram that provides advanced functionality for analyzing chats, monitoring profiles, and visualizing user interactions. The tool features a modern interface and supports real-time updates.

## 🚀 Key Features
- 👥 Profile monitoring with change detection
- 💬 Chat analysis and message history
- 📊 Interactive visualization of user interactions
- 🔍 Advanced user search in groups
- 📱 Built-in Telegram client
- 🎯 Real-time status tracking
- 📸 Media content analysis

## 🛠 Installation

### Prerequisites
- Python 3.8 or higher
- Git
- Telegram API credentials (API_ID and API_HASH)

### Dependencies

bash
Core libraries </br>
telethon==1.34.0 </br>
eel==0.16.0 </br>
asyncio==3.4.3</br>
nest_asyncio==1.5.8</br>
Text processing and analysis</br>
nltk==3.8.1</br>
emoji==2.8.0</br>
Graph visualization</br>
networkx==3.2.1</br>
matplotlib==3.8.2</br>
Image processing</br>
opencv-python==4.8.1.78</br>
Pillow==10.1.0</br>
Data processing</br>
numpy==1.26.2</br>
Async operations</br>
aiohttp==3.9.1</br>
cryptg==0.4.0</br>
Configuration</br>
python-dotenv==1.0.0</br>



### Installation Steps
1. Clone the repository:

bash
git clone https://github.com/yourusername/paranoid.git
cd paranoid


2. Create and activate virtual environment:

bash
python -m venv venv
Windows
venv\Scripts\activate
Linux/Mac
source venv/bin/activate


3. Install dependencies:

bash
pip install -r requirements.txt


4. Configure Telegram API credentials:
- Create `config.env` in the root directory
- Add your credentials:


bash
API_ID=your_api_id
API_HASH=your_api_hash


## 🚀 Usage
1. Start the application:

bash
python main.py


2. Open your browser and navigate to the provided local URL
3. Authorize your Telegram account
4. Start using the tools

## 🔧 Features Description

### Profile Monitoring
- Real-time tracking of profile changes
- Detection of bio, name, and photo updates
- Estimated registration date calculation

### Chat Analysis
- Message statistics
- User activity analysis
- Media content analysis
- Word frequency analysis

### Built-in Client
- Chat viewing
- Message sending
- Media support
- Voice messages support

---


