# Support Agent Chatbot for CDPs

## Overview
This chatbot is designed to answer "how-to" questions related to four Customer Data Platforms (CDPs): **Segment**, **mParticle**, **Lytics**, and **Zeotap**. 

The chatbot uses **Perplexity** for web scraping to extract relevant information from the official documentation of the above platforms. Based on the scraped data, it interprets user queries and provides accurate answers.

### Documentation Sources:
- [Segment Documentation](https://segment.com/docs/?ref=nav)  
- [mParticle Documentation](https://docs.mparticle.com/)  
- [Lytics Documentation](https://docs.lytics.com/)  
- [Zeotap Documentation](https://docs.zeotap.com/home/en-us/)

---

## Tech Stack
- **Node.js**: Backend framework  
- **Express.js**: Web server  
- **Axios**: HTTP requests  
- **Cheerio** & **node-html-parser**: Web scraping  
- **dotenv**: Environment variable management  
- **Perplexity**: Used for extracting and analyzing documentation data  

---

## Installation Guide

### 1. Clone the Repository
```bash
git clone <repo url>
cd doc-scraper
```
## Install Dependencies
Install all required dependencies by running:
```bash
npm install
```
## Start the Development Server
Run the following command to start the development server:
```bash
npm start
```
## sample
<img width="995" alt="Screenshot 2025-01-14 at 1 19 26 AM" src="https://github.com/user-attachments/assets/6a523af3-4046-44b5-bb82-82d3322fc1d8" />
