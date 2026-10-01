import openai

from app.config import settings

client = openai.AsyncOpenAI(api_key=settings.openai_api_key)


async def generate_design_from_prompt(prompt: str) -> dict:
    """Call LLM to generate a system design from a text prompt."""
    # TODO: Implement with proper system prompt
    response = await client.chat.completions.create(
        model="gpt-4o",
        messages=[
            {"role": "system", "content": "You are a system design assistant. Return JSON with shapes and edges."},
            {"role": "user", "content": prompt},
        ],
        response_format={"type": "json_object"},
    )
    import json
    return json.loads(response.choices[0].message.content)


async def generate_spec_from_design(design: dict) -> str:
    """Call LLM to generate a markdown spec from a design."""
    # TODO: Implement with proper system prompt
    response = await client.chat.completions.create(
        model="gpt-4o",
        messages=[
            {"role": "system", "content": "You write detailed markdown specs from system designs."},
            {"role": "user", "content": str(design)},
        ],
    )
    return response.choices[0].message.content
