# life/exception_handler.py
from rest_framework.views import exception_handler
from rest_framework.exceptions import Throttled
from django.utils.translation import gettext_lazy as _

def custom_exception_handler(exc, context):

    response = exception_handler(exc, context)

    #      (Throttled)
    if isinstance(exc, Throttled) and response is not None:
        wait_time = exc.wait
        if wait_time:
            minutes = wait_time // 60
            seconds = wait_time % 60
            if minutes > 0:
                time_str = f"{minutes} دقيقة و {seconds} ثانية"
            else:
                time_str = f"{seconds} ثانية"

            response.data['detail'] = f"لقد طلبت الرمز عدة مرات متتالية. يرجى الانتظار {time_str} قبل المحاولة مرة أخرى."
            response.data['wait_time'] = int(wait_time)
        else:
            response.data['detail'] = "لقد تجاوزت الحد المسموح. يرجى المحاولة لاحقاً."

    return response
