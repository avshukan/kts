import re

from bs4 import BeautifulSoup
import requests

ADDR = 'http://127.0.0.1:8899'


def test_app():
    response = requests.get(ADDR)
    assert response.status_code == 200, 'status ok'
    assert len(response.content) > 0
    parsed = BeautifulSoup(response.text, features="html.parser")

    stylesheet_link = None
    for link in parsed.find_all('link'):
        href = link.get('href')
        rel = link.get('rel')
        print(href, rel)

        if 'stylesheet' in rel:
            stylesheet_link = href

    assert stylesheet_link is not None, 'stylesheet found'
    assert re.match(r'.*main\..+.css', stylesheet_link), 'correct name'

    link_response = requests.get(ADDR + stylesheet_link)
    assert link_response.status_code == 200, 'styles ok'
    assert len(link_response.content) > 0, 'styles contents ok'
