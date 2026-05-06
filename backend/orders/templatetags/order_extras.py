from django import template

register = template.Library()

@register.filter
def get_item(dictionary, key):
    """

    Usage: {{ mydict|get_item:key }}
    """
    if dictionary:
        return dictionary.get(key)
    return None

@register.filter
def startswith(text, starts):
    if isinstance(text, str):
        return text.startswith(starts)
    return False
