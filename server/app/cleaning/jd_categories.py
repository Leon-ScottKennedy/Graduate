from .jd_goods import clean_text
import re

CATEGORIES = {
    'cpu': '处理器', 'gpu': '显卡', 'board': '主板', 'ram': '内存',
    'ssd': '固态硬盘', 'power': '电源', 'case': '机箱', 'cooler': '散热器',
}
NAMES = {
    'CPU': 'cpu', '处理器': 'cpu', '显卡': 'gpu', '主板': 'board',
    '内存': 'ram', '固态硬盘': 'ssd', 'SSD固态硬盘': 'ssd',
    '电源': 'power', '机箱': 'case', '散热器': 'cooler', '散热器/风扇': 'cooler',
}


def hardware_category(item):
    info = item.get('categoryInfo')
    if not isinstance(info, dict):
        return None
    # Exact category matching, never infer from a title containing CPU/电源/etc.
    if clean_text(info.get('cid2Name')) != '电脑组件':
        return None
    category = NAMES.get(clean_text(info.get('cid3Name')))
    if category == 'cooler':
        title = clean_text(item.get('skuName'))
        if re.search(r'扣具|安装支架|风扇支架', title):
            return None
        if re.search(r'硅脂|导热膏|散热膏|导热垫', title) and not re.search(r'散热器|双塔|单塔|风冷|水冷', title):
            return None
        if re.search(r'机箱风扇|风扇套装', title) and not re.search(r'CPU散热器|双塔|单塔|水冷排', title, re.I):
            return None
    return category
