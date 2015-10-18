package arklay.quickcalc;

import android.support.v7.app.AppCompatActivity;
import android.os.Bundle;
import android.view.View;
import android.widget.EditText;

public class Cable_Calculator extends AppCompatActivity {

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        setContentView(R.layout.activity_cable__calculator);
    }
    public float format(EditText input)//takes input of EditText from Textbox and converts to float.
    {
        float result=0;
        String Box4str=input.getText().toString();
        if(Box4str != null && !Box4str.isEmpty())
        {
            result = Float.parseFloat(Box4str);
        }
        return result;
    }

    public void Calculate(View v)
    {  //Put display of calculation here.

    }

}

