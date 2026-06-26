from langchain.agents import create_agent
from langchain_openai import ChatOpenAI
from langchain_core.prompts import ChatPromptTemplate
from langchain_core.output_parsers import StrOutputParser

from tools import web_search, scrape_url

from dotenv import load_dotenv
load_dotenv()
# model setup
llm= ChatOpenAI(model="gpt-4o-mini", temperature=0)

#creating agent
#agent 1 search agent 

def build_search_agent():
    return create_agent(
        model=llm,
        tools=[web_search],

    )

# agent 2 scraping agent or reader agent 

def build_scraping_agent():
    return create_agent(
        model=llm,
        tools=[scrape_url
        ]
    )
    