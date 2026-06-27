from agents import build_search_agent, build_scraping_agent, writer_chain, critic_chain

#calling agent 1
def run_research_pipeline(topic: str)-> dict:

    state={}
    # search agent working 
    print("\n" +"="*50)
    print("step 1 - search agent is working...")
    print("="*50 + "\n")

    search_agent= build_search_agent()
    search_result=search_agent.invoke({"messages":[(
        "user",f"Find recent, reliable and detailed inforamtion about: {topic}"
    )]
    })   
    state['search_result']=search_result['messages'][-1].content

    print(f"Search results:\n{state['search_result']}")


# calling agent 2 

    print("\n" +"="*50)
    print("step 2 - Reader agent is working...")
    print("="*50 + "\n")


    reader_agent= build_scraping_agent()
    reader_result =reader_agent.invoke({
        "messages": [(
            "user", f"Based on the following search results about '{topic}'"
            f"Pick the most relevant URL and scrape it for deeper content. \n\n\n"
            f"Search Results:\n {state['search_result'][:800]}"
        )]
    })

    state["scraped_content"]= reader_result['messages'][-1].content
    print("\n\n scraped content \n", state["scraped_content"])

    # step 3 writer chain
    print("\n" +"="*50)
    print("step 3 - writer is drafing the report...")
    print("="*50 + "\n")

    research_combined= (
        f"SEARCH RESULTS : \n {state['search_result']} \n\n"
        f" DEATAILED SCRAPED CONTENT \n {state['scraped_content']}"
    )

    state['report']=writer_chain.invoke(
        {
            "topic": topic,
            "research": research_combined
        }
    )

    print("\n Final Report \n", state['report'])


    #crtic report
    print("\n" +"="*50)
    print("step 3 - Crititc is reviewing the report...")
    print("="*50 + "\n") 

    state["feedback"]=critic_chain.invoke(
        {
            "report": state['report']

        }
    )

    print("\n\n Crtic reprot \n\n", state["feedback"])

    return state


if __name__ == "__main__":
    topic= input("\n Enter a reseach topic ")
    run_research_pipeline(topic)






