package arklay.quickcalc;

import android.support.v7.app.AppCompatActivity;
import android.os.Bundle;
import android.widget.EditText;

public class ShortCircuit extends AppCompatActivity {

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        setContentView(R.layout.activity_short_circuit);
    }
    public double format(EditText input)//takes input of EditText from Textbox and converts to float.
    {
        double result = 0;
        String Box4str = input.getText().toString();
        if (Box4str != null && !Box4str.isEmpty()) {
            result = Float.parseFloat(Box4str);
        }
        return result;
    }



    
}
