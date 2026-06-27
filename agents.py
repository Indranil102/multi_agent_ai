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

# now we creating chain of agents

#using LCEL runnable pipeline 
#3 use the writer chain using LCEL pipe which takes all the research and writesa full report 
writer_prompt= ChatPromptTemplate.from_messages([
    ("System", "You area an expert research writer. Write clear, strucutred and insightful report"),

    ("Human",f""" Write a detailed research report on the topic below.
    Topic:{topic}
    Research Gathered:
    {research}

    Structure the report as:
    - Introduction
    - Key FIndings (minimum 2 well -explained points)
    - Conclusion 
    - Sources (List all URLs foud in the research)

    Be detailed and include all the information from the research.
    """)

])

writer_chain= writer_prompt | llm | StrOutputParser()



#4 critic chain which reads the report and gives a score and feedback

critic_prompt= ChatPromptTemplate.from_messages([
     ("system", "You are a sharp and constructive research critic. Be honest and specific."),
    ("human", """Review the research report below and evaluate it strictly.

    Report:
    {report}
    
    Respond in this exact format:
    
    Score: X/10
    
    Strengths:
    - ...
    - ...
    
    Areas to Improve:
    - ...
    - ...
    
    One line verdict:
    ..."""),
])
 
 critic_chain= critic_prompt | llm | StrOutputParser()