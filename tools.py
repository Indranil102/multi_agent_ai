from langchain.tools import tool
import requests
from bs4 import BeautifulSoup
from tavily import TavilyClient
import os
from dotenv import load_dotenv
load_dotenv()


tavily= TavilyClient(api_key=os.getenv("TAVALY_API_KEY"))